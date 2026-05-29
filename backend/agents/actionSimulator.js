/**
 * CIRO — Action Simulation Agent (CRITICAL for hackathon)
 * Simulates traffic reroute, emergency tickets, alerts — writes before/after outcomes.
 */

const { db } = require('../lib/firebase-admin');
const { normalizeAreaKey, AREA_COORDINATES } = require('../lib/constants');
const { getAreaRoutes, isKarachiArea } = require('../lib/areaRoutes');
const { sendAreaPushNotification } = require('../lib/pushNotifications');
const { sendWhatsAppMessage } = require('./dispatchAgent');
const { routeSupply } = require('./supplyRouter');

function buildMapRoutes(areaKey, areaLabel, plan, detection) {
  const routes = getAreaRoutes(areaLabel);
  const coord = AREA_COORDINATES[areaKey] || { latitude: 24.89, longitude: 67.04 };
  const lat = coord.latitude;
  const lng = coord.longitude;

  // Build realistic road-like coordinates relative to city center
  // Main corridor: east-west through city
  const mainCoords = [
    { latitude: lat - 0.03,  longitude: lng - 0.045 },
    { latitude: lat - 0.015, longitude: lng - 0.025 },
    { latitude: lat,         longitude: lng },
    { latitude: lat + 0.01,  longitude: lng + 0.025 },
    { latitude: lat + 0.02,  longitude: lng + 0.045 },
  ];

  // Alternate bypass: loops south of city
  const altCoords = [
    { latitude: lat - 0.03,  longitude: lng - 0.045 },
    { latitude: lat - 0.04,  longitude: lng - 0.02 },
    { latitude: lat - 0.038, longitude: lng + 0.01 },
    { latitude: lat - 0.025, longitude: lng + 0.035 },
    { latitude: lat + 0.02,  longitude: lng + 0.045 },
  ];

  return routes.map((r, idx) => {
    const isBlocked = detection.active && plan.blockedRouteId === r.id;
    const isAlternate =
      plan.alternateRouteId === r.id || r.road === 'N55' || r.road === 'alt';
    const isRecommended = detection.active && isAlternate && !isBlocked;

    let status = 'clear';
    if (isBlocked) status = 'blocked';
    else if (isRecommended) status = 'rerouted';
    else if (
      detection.active &&
      !isAlternate &&
      ['urban_flooding', 'road_blockage', 'accident'].includes(detection.situationType) &&
      idx === 0 &&
      !plan.blockedRouteId
    ) {
      status = 'partial';
    }

    const lineCoords =
      isAlternate || r.road === 'N55' || r.road === 'alt' || r.id.endsWith('_alt')
        ? altCoords
        : mainCoords;

    return {
      id: r.id,
      name: r.name,
      road: r.road,
      status,
      coordinates: lineCoords,
      isAlternate,
      isRecommended,
      extraMinutes: isRecommended ? plan.etaExtraMinutes || 25 : 0,
      reasoning: isBlocked
        ? `${detection.situationLabel}: corridor affected (simulated)`
        : isRecommended
          ? `CIRO recommended alternate — ${plan.alternateRoad}`
          : 'Clear — monitoring',
    };
  });
}

async function simulateActions(areaLabel, detection, plan) {
  if (!db) return null;

  const areaKey = normalizeAreaKey(areaLabel);
  const now = Date.now();
  const ticketId = `TKT-${areaKey.toUpperCase().slice(0, 6)}-${now.toString(36).slice(-5)}`;

  const before = {
    congestionLevel: detection.active ? 'high' : 'normal',
    routesBlocked: detection.active ? 1 : 0,
    alertsSent: 0,
    emergencyTickets: 0,
    timestamp: now,
  };

  const executionLog = [];

  // 1. Update per-area map routes (predicted / simulated)
  const mapRoutes = buildMapRoutes(areaKey, areaLabel, plan, detection);
  await db.ref(`map_routes/${areaKey}`).set({
    routes: mapRoutes,
    recommendedAlternate: plan.alternateRouteId,
    situationType: detection.situationType,
    updatedAt: now,
  });
  executionLog.push({ step: 'map_routes_updated', status: 'done', detail: `${mapRoutes.length} corridors` });

  // 2. Per-route supply_status (only blocked + alternate — not all routes)
  for (const mr of mapRoutes) {
    await db.ref(`supply_status/${areaKey}_${mr.id}`).update({
      route_name: mr.name,
      road: mr.road,
      area: areaKey,
      areaLabel,
      status: mr.status,
      coordinates: mr.coordinates,
      isRecommended: mr.isRecommended,
      extra_minutes: mr.extraMinutes || 0,
      reasoning: mr.reasoning,
      updatedAt: now,
      source: 'ciro_simulator',
    });
  }
  executionLog.push({ step: 'supply_status_sync', status: 'done' });

  // 3. Emergency ticket
  let ticket = null;
  if (detection.active) {
    ticket = {
      id: ticketId,
      area: areaKey,
      areaLabel,
      type: detection.situationType,
      severity: detection.severity,
      status: 'simulated_dispatched',
      title: `${detection.situationLabel} — ${areaLabel}`,
      description: detection.explanationEnglish,
      actions: plan.actions.map((a) => a.id),
      createdAt: now,
    };
    await db.ref(`emergency_tickets/${areaKey}/${ticketId}`).set(ticket);
    executionLog.push({ step: 'emergency_ticket_created', status: 'done', id: ticketId });
  }

  // 4. Simulated alerts
  const alertsSent = [];
  if (detection.active) {
    const alertBody =
      detection.explanationUrdu ||
      `${detection.situationLabelUrdu}: ${plan.actions[0]?.descriptionUrdu || 'ردعمل جاری'}`;

    await db.ref(`area_alerts/${areaKey}`).push({
      agent: 'ciro_simulator',
      action: 'simulated_alert',
      severity: detection.severity === 'critical' ? 'critical' : 'warning',
      detail: alertBody,
      situationType: detection.situationType,
      confidence: detection.confidence,
      timestamp: now,
    });
    alertsSent.push({ channel: 'firebase', type: 'area_alert' });

    await sendAreaPushNotification(areaKey, 'khareedar', {
      title: `CIRO: ${detection.situationLabel}`,
      body: alertBody.slice(0, 120),
      type: 'crisis_alert',
    });
    alertsSent.push({ channel: 'expo_push', type: 'crisis_alert' });

    const broadcastPhone = process.env.CIRO_ALERT_PHONE || process.env.DISPATCH_DRIVER_PHONE;
    if (broadcastPhone) {
      const ok = await sendWhatsAppMessage(
        broadcastPhone,
        `*Bazar CIRO*\n${detection.situationLabel}\n${areaLabel}\n${detection.explanationEnglish?.slice(0, 200)}`
      );
      if (ok) alertsSent.push({ channel: 'whatsapp', type: 'crisis_broadcast' });
    }
    executionLog.push({ step: 'alerts_sent', status: 'done', channels: alertsSent.length });
  }

  // 5. Supply router simulation for road crises
  if (
    detection.active &&
    ['urban_flooding', 'road_blockage', 'accident', 'supply_disruption'].includes(detection.situationType)
  ) {
    await routeSupply({
      break: true,
      road: plan.alternateRoad || 'N55',
      goods: ['atta_10kg', 'general'],
      areas: [areaLabel],
      severity: detection.confidence,
      reasoning: detection.explanationEnglish,
    });
    executionLog.push({ step: 'supply_reroute_simulated', status: 'done' });
  }

  const after = {
    congestionLevel: detection.active ? 'reduced (simulated)' : 'normal',
    routesBlocked: detection.active ? 0 : 0,
    routesRerouted: detection.active ? 1 : 0,
    alertsSent: alertsSent.length,
    emergencyTickets: ticket ? 1 : 0,
    recommendedRoute: plan.alternateRouteId,
    timestamp: Date.now(),
  };

  const simulation = {
    areaKey,
    areaLabel,
    before,
    after,
    outcome:
      detection.active
        ? `Simulated ${plan.actions.length} actions — congestion reduced via ${plan.alternateRoad || 'alternate'} route`
        : 'No actions required — area stable',
    executionLog,
    simulatedAt: now,
  };

  await db.ref(`crisis_simulation/${areaKey}`).set(simulation);

  await db.ref(`crisis_situations/${areaKey}`).set({
    ...detection,
    plan: plan.actions,
    simulationSummary: simulation.outcome,
    ticketId: ticket?.id || null,
    updatedAt: now,
  });

  await db.ref(`crisis_actions/${areaKey}`).set({
    actions: plan.actions,
    blockedRouteId: plan.blockedRouteId,
    alternateRouteId: plan.alternateRouteId,
    alternateRoad: plan.alternateRoad,
    etaExtraMinutes: plan.etaExtraMinutes,
    executedAt: now,
    executionLog,
  });

  await db.ref('agent_log').push({
    agent: 'ciro_simulator',
    action: detection.active ? 'crisis_response_simulated' : 'all_clear',
    detail: `[${areaLabel}] ${detection.situationLabel} (${Math.round(detection.confidence * 100)}%) → ${simulation.outcome}`,
    severity: detection.severity === 'critical' ? 'critical' : 'info',
    area: areaKey,
    timestamp: now,
  });

  return simulation;
}

module.exports = { simulateActions, buildMapRoutes };

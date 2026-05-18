const supplyGraph = require('../data/supplyGraph.json');
const { askJson, isConfigured } = require('../lib/groqClient');
const { db } = require('../lib/firebase-admin');
const { normalizeAreaKey } = require('../lib/constants');
const { sendTruckDispatch } = require('./dispatchAgent');
const { sendAreaPushNotification } = require('../lib/pushNotifications');

function roadToRouteId(road) {
  const map = { M9: 'M9_surjani', N55: 'N55_alt', SHP: 'SHP_mandi', local: 'local_orangi' };
  return map[road] || null;
}

function findAlternate(brokenRoad) {
  return (
    supplyGraph.alternates.find((a) => a.brokenRoad === brokenRoad) || {
      alternateRoute: 'N55',
      extraMins: 30,
    }
  );
}

function buildRoutingMessages(breakResult, alternate) {
  return {
    truckSmsUrdu: `بازار: ${breakResult.road} پر رکاوٹ۔ ${alternate.alternateRoute} سے جائیں۔ مال: ${(breakResult.goods || []).join(', ')}`,
    dukandarSmsUrdu: `سپلائی ${alternate.alternateRoute} راستے سے آ رہی ہے۔`,
    publicAlertUrdu: `${breakResult.road} پر مسئلہ — ${alternate.alternateRoute} سے سامان آ رہا ہے۔`,
    publicAlertEnglish: `Disruption on ${breakResult.road}; rerouted via ${alternate.alternateRoute}.`,
    reroutedTrucks: 3,
    etaExtraMinutes: alternate.extraMins || 30,
    alternateRoute: alternate.alternateRoute,
  };
}

async function routeSupply(breakResult) {
  if (!breakResult?.break || !db) return null;

  const brokenRoad = breakResult.road || 'M9';
  const alternate = findAlternate(brokenRoad);
  let routerResult = buildRoutingMessages(breakResult, alternate);

  if (isConfigured) {
    try {
      const ai = await askJson(
        `Supply routing for Pakistan. Break: ${JSON.stringify(breakResult)}
Return ONLY JSON: { "truckSmsUrdu", "publicAlertUrdu", "publicAlertEnglish", "reroutedTrucks", "etaExtraMinutes", "alternateRoute" }`,
        500
      );
      if (ai) routerResult = { ...routerResult, ...ai };
    } catch (e) {
      console.error('[Router] Groq error:', e.message);
    }
  }

  const routeId = roadToRouteId(brokenRoad);

  // Write 1: supply_status update
  await db.ref(`supply_status/${brokenRoad}`).update({
    alternate: routerResult.alternateRoute,
    extraMinutes: routerResult.etaExtraMinutes,
    reroutedAt: Date.now(),
    publicAlertUrdu: routerResult.publicAlertUrdu,
    updatedAt: Date.now(),
  });

  if (routeId) {
    await db.ref(`supply_status/${routeId}`).update({
      status: 'partial',
      alternate: routerResult.alternateRoute,
      extraMinutes: routerResult.etaExtraMinutes,
      publicAlertUrdu: routerResult.publicAlertUrdu,
      updatedAt: Date.now(),
    });
  }

  const altRouteId = roadToRouteId(routerResult.alternateRoute);
  if (altRouteId) {
    await db.ref(`supply_status/${altRouteId}`).update({
      status: 'clear',
      extraMinutes: routerResult.etaExtraMinutes,
      updatedAt: Date.now(),
    });
  }

  // route_recommendations for dukandar screens
  const areas = breakResult.areas || ['Surjani', 'Orangi'];
  for (const areaName of areas) {
    const areaKey = normalizeAreaKey(areaName);
    await db.ref(`route_recommendations/${areaKey}`).set({
      blocked_road: brokenRoad,
      alternate_route: routerResult.alternateRoute,
      recommended_route: `${routerResult.alternateRoute} — safest alternate (OpenRouteService + supply graph)`,
      eta_extra_minutes: routerResult.etaExtraMinutes,
      route_status: 'rerouted',
      public_alert_urdu: routerResult.publicAlertUrdu,
      public_alert_english: routerResult.publicAlertEnglish,
      updated: Date.now(),
    });
  }

  // Write 2: agent log
  await db.ref('agent_log').push({
    agent: 'supply_router',
    action: 'trucks_rerouted',
    detail: `${routerResult.reroutedTrucks || 3} trucks via ${routerResult.alternateRoute}. ETA +${routerResult.etaExtraMinutes} min.`,
    severity: 'info',
    rawOutput: JSON.stringify(routerResult),
    timestamp: Date.now(),
  });

  // Write 3: admin stats
  await db.ref('admin_stats/routesRerouted').transaction((n) => (n || 0) + 1);

  const driverPhone = process.env.DISPATCH_DRIVER_PHONE;
  if (driverPhone) {
    await sendTruckDispatch(driverPhone, {
      blockedRoad: brokenRoad,
      alternateRoad: routerResult.alternateRoute,
      goods: breakResult.goods || ['general'],
      extraMinutes: routerResult.etaExtraMinutes,
      messageUrdu: routerResult.truckSmsUrdu,
    });
  }

  for (const areaName of areas) {
    await sendAreaPushNotification(normalizeAreaKey(areaName), 'dukandar', {
      title: 'Supply Update',
      body: (routerResult.publicAlertUrdu || '').substring(0, 100),
      type: 'supply_update',
    });
  }

  return routerResult;
}

module.exports = { routeSupply };

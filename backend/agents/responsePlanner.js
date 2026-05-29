const { db } = require('../lib/firebase-admin');
const { askJson, isConfigured } = require('../lib/groqClient');
const alternateRoutes = require('../data/alternateRoutes.json');
const { routeSupply } = require('./supplyRouter');

function defaultPlan(crisis, situation) {
  const loc = crisis.location || 'area';
  const alts = alternateRoutes[loc] || alternateRoutes.default || [];
  const alt = alts[0];

  const actions = [
    {
      id: 'action_001',
      type: 'traffic_reroute',
      priority: 1,
      title: `Reroute traffic via ${alt?.name || 'alternate corridor'}`,
      description: `Redirect blocked roads near ${loc}`,
      targetAgency: 'CDA Traffic',
      estimatedImpact: 'Reduce congestion ~60%',
      estimatedTimeMinutes: alt?.extraMinutes || 20,
      alternateRoute: alt?.id || 'alternate',
      status: 'pending',
      simulatedAt: null,
    },
    {
      id: 'action_002',
      type: 'emergency_dispatch',
      priority: 2,
      title: 'Dispatch Rescue 1122 + Police',
      description: `Notify Rescue 1122 and Police for ${crisis.type} at ${loc}`,
      targetAgency: 'Rescue 1122',
      estimatedImpact: 'Emergency units en route',
      estimatedTimeMinutes: 12,
      status: 'pending',
      simulatedAt: null,
    },
    {
      id: 'action_003',
      type: 'public_alert',
      priority: 3,
      title: 'Broadcast public safety alert',
      description: `Push alert to residents near ${loc}`,
      targetAgency: 'NDMA',
      estimatedImpact: `Reach ${situation?.impactDetails?.affectedPopulation || 5000}+ residents`,
      estimatedTimeMinutes: 5,
      status: 'pending',
      simulatedAt: null,
    },
  ];

  if (crisis.type === 'accident' || crisis.type === 'road_blockage') {
    actions.unshift({
      id: 'action_000',
      type: 'emergency_dispatch',
      priority: 1,
      title: 'Police + Ambulance to accident scene',
      description: 'ICT Police (15) and Edhi (115) notified',
      targetAgency: 'Police',
      estimatedImpact: 'First responders dispatched',
      estimatedTimeMinutes: 8,
      status: 'pending',
      simulatedAt: null,
    });
  }

  return { actions, generatedAt: Date.now() };
}

async function planResponse(crisis, situation) {
  let result = defaultPlan(crisis, situation);

  if (isConfigured) {
    const ai = await askJson(
      `CIRO response planner. Crisis: ${JSON.stringify(crisis)}. Situation: ${JSON.stringify(situation)}.
Return ONLY JSON: { "actions": [{ "id", "type", "priority", "title", "description", "targetAgency", "estimatedImpact", "estimatedTimeMinutes", "alternateRoute" }] }`,
      800
    );
    if (ai?.actions?.length) {
      result.actions = ai.actions.map((a) => ({ ...a, status: 'pending', simulatedAt: null }));
    }
  }

  if (!db) return result;

  await db.ref(`response_plans/${crisis.crisisId}`).set(result);
  await db.ref(`crisis_events/${crisis.crisisId}/status`).set('responding');

  await db.ref('action_log').push({
    agent: 'response_planner',
    crisisId: crisis.crisisId,
    action: 'plan_generated',
    detail: `${result.actions.length} coordinated actions for ${crisis.type} at ${crisis.location}`,
    severity: 'info',
    timestamp: Date.now(),
  });

  const supplyAction = result.actions.find((a) => a.type === 'supply_reroute');
  if (supplyAction) {
    await routeSupply({
      break: true,
      type: 'road_blocked',
      road: 'M9',
      goods: ['atta', 'vegetables'],
      areas: [crisis.location],
      severity: crisis.severityScore || 0.8,
      reasoning: `CIRO supply reroute: ${crisis.type}`,
    }).catch(() => {});
  }

  return result;
}

module.exports = { planResponse };

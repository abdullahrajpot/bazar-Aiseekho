const { db } = require('../lib/firebase-admin');
const { askJson, isConfigured } = require('../lib/groqClient');
const emergencyResources = require('../data/emergencyResources.json');

function ruleBasedSituation(crisis) {
  const pop = crisis.severity === 'critical' ? 15000 : crisis.severity === 'high' ? 8000 : 3000;
  return {
    affectedArea: crisis.location,
    impactSummary: `${crisis.type.replace(/_/g, ' ')} affecting ${crisis.location}`,
    impactDetails: {
      roadsBlocked: [crisis.location],
      vehiclesStranded: crisis.type === 'accident' ? 8 : crisis.type.includes('flood') ? 40 : 15,
      trafficIncreasePercent: crisis.severity === 'critical' ? 280 : 120,
      estimatedClearanceHours: 3,
      hospitalAccessRisk: crisis.severity === 'critical' ? 'high' : 'medium',
      affectedPopulation: pop,
      supplyChainImpact: crisis.type === 'supply_disruption' ? 'high' : 'medium',
    },
    confidence: crisis.confidence || 0.75,
    confidenceExplanation: crisis.confidenceReason || 'Based on corroborating signals.',
  };
}

async function analyseSituation(crisis) {
  const { crisisId, type, location, severityScore, confidence } = crisis;
  const resources =
    emergencyResources[location] ||
    emergencyResources[location?.split(' ')[0]?.toLowerCase()] ||
    emergencyResources.default;

  let result = ruleBasedSituation(crisis);

  if (isConfigured) {
    const ai = await askJson(
      `CIRO situation analyser Pakistan.
Crisis: ${JSON.stringify({ type, location, severity: crisis.severity, confidence, triggerSignals: crisis.triggerSignals })}
Resources: ${JSON.stringify(resources)}
Return ONLY JSON: { "affectedArea", "impactSummary", "impactDetails": { "roadsBlocked", "vehiclesStranded", "trafficIncreasePercent", "estimatedClearanceHours", "hospitalAccessRisk", "affectedPopulation", "supplyChainImpact" }, "confidence", "confidenceExplanation" }`,
      650
    );
    if (ai?.impactSummary) result = { ...result, ...ai };
  }

  if (!db) return result;

  await db.ref(`crisis_situations/${crisisId}`).set({
    ...result,
    crisisType: type,
    analysedAt: Date.now(),
  });

  await db.ref(`crisis_events/${crisisId}/status`).set('analysing');

  await db.ref('action_log').push({
    agent: 'situation_analyser',
    crisisId,
    action: 'situation_analysed',
    detail: `Impact: ${result.impactSummary}`,
    severity: 'warning',
    timestamp: Date.now(),
  });

  return result;
}

module.exports = { analyseSituation };

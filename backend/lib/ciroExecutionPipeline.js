/**
 * BAZAR_CIRO_EXECUTION — full pipeline (Groq, not Claude)
 * detect → analyse → plan → simulate → outcome → emergency dispatch
 */

const { detectCrisisEvent } = require('../agents/crisisDetector');
const { analyseSituation } = require('../agents/situationAnalyser');
const { planResponse } = require('../agents/responsePlanner');
const { simulateExecution } = require('../agents/ciroExecutionSimulator');
const { calculateOutcome } = require('../agents/outcomeEngine');
const { analyzeIncidentImage } = require('../agents/incidentVision');
const { updateRegionalMarket } = require('../agents/regionalMarketAgent');
const { db } = require('./firebase-admin');
const { normalizeAreaKey } = require('./constants');

async function runFullCiroPipeline(signals, options = {}) {
  const { text, area, imageBase64, imageMime, lat, lng, uid } = options;
  let visionAnalysis = null;

  if (imageBase64) {
    visionAnalysis = await analyzeIncidentImage(imageBase64, imageMime || 'image/jpeg', {
      area,
      text,
      lat,
      lng,
    });
  }

  const crisis = await detectCrisisEvent(signals, text, area, {
    visionAnalysis,
    locationCoords: lat && lng ? { lat: Number(lat), lng: Number(lng) } : visionAnalysis?.locationCoords,
    imageUrl: options.imageUrl,
  });

  if (!crisis.crisisDetected) {
    return { crisisDetected: false, message: 'No crisis detected from current signals' };
  }

  const situation = await analyseSituation(crisis);
  const plan = await planResponse(crisis, situation);
  const sim = await simulateExecution(crisis, situation, plan);
  const outcome = await calculateOutcome(crisis, situation);

  const areaKey = normalizeAreaKey(area || crisis.location);
  if (db && options.incidentId) {
    await db.ref(`incident_reports/${options.incidentId}`).update({
      crisisId: crisis.crisisId,
      status: 'processed',
      visionAnalysis,
      updatedAt: Date.now(),
    });
  }

  await db.ref(`map_incidents/${areaKey}/${crisis.crisisId}`).set({
    crisisId: crisis.crisisId,
    type: crisis.type,
    location: crisis.location,
    locationCoords: crisis.locationCoords,
    severity: crisis.severity,
    status: 'active',
    hasImage: Boolean(imageBase64),
    imageUrl: options.imageUrl || null,
    uid: uid || null,
    updatedAt: Date.now(),
  });

  const radius =
    situation?.impactDetails?.affectedPopulation > 10000 ? 2500 : 1500;
  await db.ref(`crisis_affected_zones/${areaKey}`).set({
    zones: [
      {
        id: crisis.crisisId,
        center: crisis.locationCoords,
        radiusMeters: radius,
        severity: crisis.severity,
        type: crisis.type,
        label: crisis.location,
      },
    ],
    activeCrisisId: crisis.crisisId,
    updatedAt: Date.now(),
  });

  await updateRegionalMarket(area || crisis.location, crisis, situation);

  return {
    crisisDetected: true,
    crisisId: crisis.crisisId,
    type: crisis.type,
    location: crisis.location,
    confidence: crisis.confidence,
    situation,
    plan,
    simulation: sim,
    outcome,
    visionAnalysis,
  };
}

module.exports = { runFullCiroPipeline };

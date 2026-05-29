/**
 * Writes map_incidents + crisis_affected_zones from rule-based detection (no full Groq pipeline).
 */
const { db } = require('./firebase-admin');
const { normalizeAreaKey, AREA_COORDINATES } = require('./constants');

function mapTypeToSchema(type) {
  const m = {
    urban_flooding: 'flood',
    infrastructure_failure: 'infrastructure',
    supply_disruption: 'road_blockage',
    earthquake: 'earthquake',
  };
  return m[type] || type || 'incident';
}

function coordsForLocation(location, areaKey) {
  if (AREA_COORDINATES[areaKey]) {
    const c = AREA_COORDINATES[areaKey];
    return { lat: c.latitude, lng: c.longitude };
  }
  if (/g-?10/i.test(location || '')) return { lat: 33.6844, lng: 73.0479 };
  return { lat: 24.89, lng: 67.04 };
}

function severityRadius(severity) {
  if (severity === 'critical') return 3500;
  if (severity === 'high') return 2500;
  if (severity === 'medium') return 1800;
  return 1200;
}

async function findRecentCrisis(areaKey, type, windowMs = 30 * 60 * 1000) {
  if (!db) return null;
  const snap = await db.ref('crisis_events').orderByChild('detectedAt').limitToLast(20).once('value');
  const data = snap.val() || {};
  const now = Date.now();
  for (const [id, ev] of Object.entries(data)) {
    if (ev.areaKey !== areaKey) continue;
    if (mapTypeToSchema(ev.type) !== mapTypeToSchema(type)) continue;
    if (now - (ev.detectedAt || 0) < windowMs) return { id, ...ev };
  }
  return null;
}

/**
 * Autonomous map sync: red zones + incident pins for any active detection.
 */
async function syncMapOverlayFromDetection(areaLabel, detection, options = {}) {
  if (!db || !detection?.active) return null;

  const areaKey = normalizeAreaKey(areaLabel);
  const type = mapTypeToSchema(options.type || detection.situationType);
  const location = detection.locationHint || areaLabel;
  const locationCoords = options.locationCoords || coordsForLocation(location, areaKey);
  const severity = detection.severity || 'medium';

  let crisisId = options.crisisId;
  const recent = await findRecentCrisis(areaKey, type);
  if (recent) {
    crisisId = recent.id;
  } else if (!crisisId) {
    crisisId = db.ref('crisis_events').push().key;
    await db.ref(`crisis_events/${crisisId}`).set({
      type,
      location,
      locationCoords,
      severity,
      severityScore: detection.confidence,
      confidence: detection.confidence,
      confidenceReason: detection.explanationEnglish || 'Autonomous agent detection from news & feeds',
      triggerSignals: (detection.evidence || []).slice(0, 5).map((e) => (e.text || '').slice(0, 100)),
      detectedAt: Date.now(),
      status: 'detected',
      areaKey,
      source: 'ciro_autonomous',
    });
  }

  await db.ref(`map_incidents/${areaKey}/${crisisId}`).set({
    crisisId,
    type,
    location,
    locationCoords,
    severity,
    status: 'active',
    confidence: detection.confidence,
    label: detection.situationLabel,
    labelUrdu: detection.situationLabelUrdu,
    sources: (detection.evidence || []).slice(0, 3).map((e) => e.source),
    updatedAt: Date.now(),
  });

  const radius = severityRadius(severity);
  await db.ref(`crisis_affected_zones/${areaKey}`).set({
    zones: [
      {
        id: crisisId,
        center: locationCoords,
        radiusMeters: radius,
        severity,
        type,
        label: location,
      },
    ],
    activeCrisisId: crisisId,
    updatedAt: Date.now(),
  });

  await db.ref('action_log').push({
    agent: 'ciro_map_agent',
    crisisId,
    action: 'map_zone_updated',
    detail: `${type} — ${location} marked on map (${severity})`,
    severity: severity === 'critical' ? 'critical' : 'warning',
    timestamp: Date.now(),
  });

  return crisisId;
}

module.exports = { syncMapOverlayFromDetection, mapTypeToSchema, coordsForLocation };

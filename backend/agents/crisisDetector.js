/**
 * CIRO — Crisis Detection Agent
 * Combines multi-source signals → situation type, confidence, impact, evidence.
 */

const { askJson, isConfigured } = require('../lib/groqClient');
const { signalMatchesArea } = require('../lib/areaRoutes');
const { normalizeAreaKey } = require('../lib/constants');

const FLOOD_RE =
  /\b(flood|flooding|flash flood|waterlog|pani bhar|پانی|سیلاب|barish|rain|monsoon|cloudburst|gaariyan phans)\b/i;
const HEAT_RE = /\b(heatwave|heat wave|گرمی|lahar|temperature record|scorching)\b/i;
const BLOCK_RE =
  /\b(block|blocked|band|بند|closure|gridlock|congestion|traffic jam|phansi|phans)\b/i;
const ACCIDENT_RE = /\b(accident|collision|crash|حادثہ|pile.?up)\b/i;
const EARTHQUAKE_RE =
  /\b(earthquake|earth quake|زلزلہ|زلزلے|tremor|seismic|richter|magnitude\s*[0-9])\b/i;
const INFRA_RE = /\b(power outage|load shedding|بجلی|gas leak|pipeline|bridge collapse|infrastructure)\b/i;

const CRISIS_TYPES = {
  urban_flooding: { label: 'Urban flooding', labelUrdu: 'شہری سیلاب' },
  heatwave: { label: 'Heatwave', labelUrdu: 'شدید گرمی کی لہر' },
  road_blockage: { label: 'Road blockage', labelUrdu: 'سڑک بند' },
  accident: { label: 'Traffic accident', labelUrdu: 'ٹریفک حادثہ' },
  earthquake: { label: 'Earthquake', labelUrdu: 'زلزلہ' },
  infrastructure_failure: { label: 'Infrastructure failure', labelUrdu: 'انفراسٹرکچر خرابی' },
  supply_disruption: { label: 'Supply disruption', labelUrdu: 'سپلائی میں رکاوٹ' },
  none: { label: 'Monitoring — no active crisis', labelUrdu: 'نگرانی — کوئی بحران نہیں' },
};

function classifyFromSignals(areaSignals) {
  const texts = areaSignals.map((s) => s.text || '').join(' ');
  const weather = areaSignals.find((s) => s.source === 'weather');
  const rain = weather?.rainMmPerHour || 0;
  const mapBlocked = areaSignals.some(
    (s) => (s.source === 'ors_maps' || s.source === 'here_maps') && s.status === 'blocked'
  );
  const mapPartial = areaSignals.some(
    (s) => (s.source === 'ors_maps' || s.source === 'here_maps') && s.status === 'partial'
  );

  const evidence = areaSignals
    .filter((s) => (s.score || 0) >= 2)
    .slice(0, 8)
    .map((s) => ({
      source: s.source,
      text: (s.text || '').slice(0, 160),
      score: s.score || 0,
    }));

  let type = 'none';
  let confidence = 0.35;
  const impacts = [];

  if (EARTHQUAKE_RE.test(texts)) {
    type = 'earthquake';
    confidence = 0.9;
    impacts.push('Structural damage risk', 'Aftershock monitoring', 'Emergency shelters on standby');
  } else if (FLOOD_RE.test(texts) || rain >= 12) {
    type = 'urban_flooding';
    confidence = rain >= 20 ? 0.92 : FLOOD_RE.test(texts) ? 0.88 : 0.75;
    impacts.push('Water accumulation on roads', 'Vehicles stranded', 'Market access limited');
  } else if (HEAT_RE.test(texts)) {
    type = 'heatwave';
    confidence = 0.82;
    impacts.push('Heat stress risk', 'Increased power demand', 'Perishable supply risk');
  } else if (mapBlocked || (BLOCK_RE.test(texts) && mapPartial)) {
    type = 'road_blockage';
    confidence = mapBlocked ? 0.9 : 0.78;
    impacts.push('Traffic blocked', 'Delivery delays', 'Alternate routing required');
  } else if (ACCIDENT_RE.test(texts)) {
    type = 'accident';
    confidence = 0.8;
    impacts.push('Lane closure', 'Emergency response needed', 'Congestion spike');
  } else if (INFRA_RE.test(texts)) {
    type = 'infrastructure_failure';
    confidence = 0.76;
    impacts.push('Service disruption', 'Coordination with utilities');
  } else if (mapPartial || BLOCK_RE.test(texts)) {
    type = 'road_blockage';
    confidence = 0.65;
    impacts.push('Partial traffic delay', 'Monitor alternate routes');
  } else if (
    areaSignals.some((s) => /\b(shortage|supply|atta|mandi)\b/i.test(s.text || '') && (s.score || 0) >= 4)
  ) {
    type = 'supply_disruption';
    confidence = 0.7;
    impacts.push('Essential goods delay', 'Price pressure possible');
  }

  const severity =
    confidence >= 0.85 ? 'critical' : confidence >= 0.65 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

  const locationHint = extractLocationHint(texts, areaSignals);

  return {
    situationType: type,
    situationLabel: CRISIS_TYPES[type]?.label || type,
    situationLabelUrdu: CRISIS_TYPES[type]?.labelUrdu || type,
    confidence: Math.round(confidence * 100) / 100,
    severity,
    impacts,
    evidence,
    locationHint,
    active: type !== 'none' && confidence >= 0.55,
    detectedAt: Date.now(),
  };
}

function extractLocationHint(texts, signals) {
  const combined = texts.toLowerCase();
  const sectors = combined.match(/\b(g-?\d+|sector [a-z0-9]+|block [a-z0-9]+)\b/gi);
  if (sectors?.length) return sectors[0];
  const tw = signals.find((s) => s.source === 'twitter' || s.source === 'whatsapp');
  if (tw?.text) return tw.text.slice(0, 80);
  return null;
}

async function detectCrisis(areaLabel, allSignals) {
  const areaKey = normalizeAreaKey(areaLabel);
  const areaSignals = (allSignals || []).filter((s) => signalMatchesArea(s, areaKey, areaLabel));

  let detection = classifyFromSignals(areaSignals);

  const useGroq =
    isConfigured &&
    process.env.CIRO_USE_GROQ !== '0' &&
    detection.active &&
    detection.confidence < 0.82;

  if (useGroq && areaSignals.length >= 2) {
    try {
      const ai = await askJson(
        `CIRO crisis detector for Pakistan. Area: ${areaLabel}
Use ONLY these signals — do not invent events.

Signals:
${JSON.stringify(areaSignals.slice(0, 18), null, 2)}

Return ONLY JSON:
{
  "situationType": "urban_flooding | heatwave | road_blockage | accident | earthquake | infrastructure_failure | supply_disruption | none",
  "confidence": 0.0,
  "severity": "critical | high | medium | low",
  "impacts": ["..."],
  "explanation_english": "one sentence citing sources",
  "explanation_urdu": "one sentence Urdu"
}`,
        450
      );
      if (ai?.situationType && ai.confidence >= 0.5) {
        detection = {
          ...detection,
          situationType: ai.situationType,
          situationLabel: CRISIS_TYPES[ai.situationType]?.label || ai.situationType,
          situationLabelUrdu: CRISIS_TYPES[ai.situationType]?.labelUrdu || ai.situationType,
          confidence: ai.confidence,
          severity: ai.severity || detection.severity,
          impacts: ai.impacts?.length ? ai.impacts : detection.impacts,
          explanationEnglish: ai.explanation_english,
          explanationUrdu: ai.explanation_urdu,
        };
        detection.active = detection.situationType !== 'none' && detection.confidence >= 0.55;
      }
    } catch {
      /* rule-based detection stands */
    }
  }

  if (!detection.explanationEnglish) {
    const srcs = [...new Set(areaSignals.map((s) => s.source))].slice(0, 5).join(', ');
    detection.explanationEnglish = detection.active
      ? `${detection.situationLabel} inferred from ${areaSignals.length} area signals (${srcs || 'feeds'}).`
      : `No crisis threshold met for ${areaLabel} in latest scan.`;
    detection.explanationUrdu = detection.active
      ? `${detection.situationLabelUrdu}: ${areaSignals.length} ذرائع سے نشاندہی۔`
      : `${areaLabel} کے لیے ابھی کوئی بحران نہیں ملا۔`;
  }

  return { ...detection, areaKey, areaLabel, signalCount: areaSignals.length };
}

const { db } = require('../lib/firebase-admin');
const { AREA_COORDINATES } = require('../lib/constants');

function mapTypeToSchema(type) {
  const m = {
    urban_flooding: 'flood',
    infrastructure_failure: 'infrastructure',
    supply_disruption: 'road_blockage',
    earthquake: 'earthquake',
  };
  return m[type] || type || 'road_blockage';
}

function coordsForLocation(location, areaKey) {
  if (AREA_COORDINATES[areaKey]) {
    const c = AREA_COORDINATES[areaKey];
    return { lat: c.latitude, lng: c.longitude };
  }
  if (/g-?10/i.test(location || '')) return { lat: 33.6844, lng: 73.0479 };
  return { lat: 24.89, lng: 67.04 };
}

/**
 * Full hackathon schema — writes crisis_events/{crisisId}
 */
async function detectCrisisEvent(signals, inputText = null, areaLabel = null, extra = {}) {
  const areaKey = areaLabel ? normalizeAreaKey(areaLabel) : null;
  const pool = areaKey
    ? (signals || []).filter((s) => signalMatchesArea(s, areaKey, areaLabel))
    : signals || [];

  if (inputText) {
    pool.unshift({
      source: 'user_report',
      text: inputText,
      score: 5,
      timestamp: Date.now(),
      area: areaKey,
    });
  }

  if (extra.visionAnalysis) {
    pool.unshift({
      source: 'incident_photo',
      text: extra.visionAnalysis.description_english || 'Photo incident',
      score: 6,
      timestamp: Date.now(),
    });
  }

  const label = areaLabel || 'Pakistan';
  const detection = await detectCrisis(label, pool.length ? pool : signals || []);

  const crisisDetected =
    detection.active ||
    extra.visionAnalysis?.crisisDetected ||
    (inputText && detection.confidence >= 0.5);

  if (!crisisDetected || !db) {
    return { crisisDetected: false };
  }

  const type = mapTypeToSchema(extra.visionAnalysis?.type || detection.situationType);
  const location = detection.locationHint || label;
  const locationCoords = extra.locationCoords || coordsForLocation(location, areaKey);

  const existingAreaKey = areaKey || normalizeAreaKey(label);
  const recentSnap = await db
    .ref('crisis_events')
    .orderByChild('detectedAt')
    .limitToLast(15)
    .once('value');
  const recentData = recentSnap.val() || {};
  const now = Date.now();
  for (const [id, ev] of Object.entries(recentData)) {
    if (ev.areaKey !== existingAreaKey) continue;
    if (mapTypeToSchema(ev.type) !== type) continue;
    if (now - (ev.detectedAt || 0) < 30 * 60 * 1000) {
      return { crisisDetected: true, crisisId: id, ...ev, type: ev.type, location: ev.location, locationCoords: ev.locationCoords };
    }
  }

  const crisisId = db.ref('crisis_events').push().key;
  const event = {
    type,
    location,
    locationCoords,
    severity: detection.severity || 'high',
    severityScore: detection.confidence,
    confidence: detection.confidence,
    confidenceReason: detection.explanationEnglish,
    triggerSignals: pool.slice(0, 5).map((s) => (s.text || '').slice(0, 100)),
    inputText: inputText || null,
    imageUrl: extra.imageUrl || null,
    detectedAt: Date.now(),
    status: 'detected',
    areaKey: existingAreaKey,
  };

  await db.ref(`crisis_events/${crisisId}`).set(event);

  const { syncMapOverlayFromDetection } = require('../lib/mapOverlayWriter');
  await syncMapOverlayFromDetection(label, detection, {
    crisisId,
    type: detection.situationType,
    locationCoords,
  });

  await db.ref('action_log').push({
    agent: 'crisis_detector',
    crisisId,
    action: 'crisis_confirmed',
    detail: `${type} at ${location} — ${Math.round(detection.confidence * 100)}% confidence`,
    severity: event.severity === 'critical' ? 'critical' : 'warning',
    timestamp: Date.now(),
  });

  await db.ref('admin_stats/crisesDetected').transaction((n) => (n || 0) + 1);

  return {
    crisisDetected: true,
    crisisId,
    ...event,
    type,
    location,
    locationCoords,
  };
}

module.exports = { detectCrisis, detectCrisisEvent, CRISIS_TYPES, classifyFromSignals };

const { db } = require('./firebase-admin');
const { normalizeAreaKey } = require('./constants');
const { signalMatchesArea } = require('./areaRoutes');
const { verifyClaimAgainstSignals } = require('./signalVerifier');
const { syncAreaSupplyStatus } = require('./syncAreaSupply');
const { detectBreakForArea } = require('../agents/supplyBreakDetector');
const { detectRumours } = require('../agents/rumourDetector');
const { publishTruth } = require('../agents/truthPublisher');
const { routeSupply } = require('../agents/supplyRouter');
const { runCiroForArea } = require('./ciroPipeline');

async function writeAreaAlert(areaKey, areaLabel, payload) {
  if (!db) return;
  await db.ref(`area_alerts/${areaKey}`).push({
    ...payload,
    area: areaKey,
    areaLabel,
    timestamp: Date.now(),
  });
}

/**
 * Run full agent pipeline for one user market area using already-fetched signals.
 */
async function processArea(areaLabel, allSignals, globalRouteStatus = {}) {
  const areaKey = normalizeAreaKey(areaLabel);
  const areaSignals = allSignals.filter((s) => signalMatchesArea(s, areaKey, areaLabel));

  await syncAreaSupplyStatus(areaLabel, allSignals, globalRouteStatus);

  // CIRO pipeline: detect → plan → simulate (overwrites map_routes + per-route status)
  let ciroResult = null;
  try {
    ciroResult = await runCiroForArea(areaLabel, allSignals);
    if (ciroResult?.detection?.active) {
      await writeAreaAlert(areaKey, areaLabel, {
        agent: 'ciro_detector',
        action: 'crisis_detected',
        severity: ciroResult.detection.severity === 'critical' ? 'critical' : 'warning',
        detail: `${ciroResult.detection.situationLabel} (${Math.round(ciroResult.detection.confidence * 100)}% confidence). ${ciroResult.detection.explanationEnglish}`,
        situationType: ciroResult.detection.situationType,
        source: 'ciro',
      });
    }
  } catch (e) {
    console.error(`[CIRO] ${areaLabel}:`, e.message);
  }

  const breakResult = await detectBreakForArea(areaSignals, areaLabel);

  if (breakResult.break && db && !ciroResult?.detection?.active) {
    breakResult.areas = [areaLabel];
    await routeSupply(breakResult);
    await writeAreaAlert(areaKey, areaLabel, {
      agent: 'supply_break_detector',
      action: 'break_confirmed',
      severity: 'critical',
      detail: breakResult.reasoning,
    });
  }

  const social = areaSignals.filter((s) =>
    ['google_news', 'reddit', 'twitter', 'ndma', 'whatsapp'].includes(s.source)
  );

  const existingSnap = await db.ref('truth_feed').limitToLast(80).once('value');
  const existing = existingSnap.val() || {};
  const existingTexts = new Set(
    Object.values(existing)
      .filter((c) => c.area === areaKey)
      .map((c) => (c.text || '').toLowerCase().trim())
  );

  let published = 0;
  for (const sig of social.slice(0, 6)) {
    const text = (sig.text || '').trim();
    if (!text || text.length < 20) continue;
    const norm = text.toLowerCase();
    if (existingTexts.has(norm)) continue;

    let result = await detectRumours(text, areaSignals, areaLabel);

    // Area-tagged live headlines (Google News / NDMA) → show as local intelligence, not generic unverified
    if (
      result.verdict === 'unverified' &&
      sig.area === areaKey &&
      (sig.score || 0) >= 4 &&
      ['google_news', 'ndma', 'reddit'].includes(sig.source)
    ) {
      result = {
        verdict: 'verified',
        confidence: 0.62,
        reason_urdu: `اس علاقے کی لائیو خبر (${sig.source}): ${text.slice(0, 100)}`,
        reason_english: `Live ${sig.source} headline for this area.`,
        counter_message_urdu: null,
        push_notification: false,
      };
    }

    if (result.verdict === 'unverified' && (sig.score || 0) < 6) continue;
    if (result.confidence < 0.55 && result.verdict === 'unverified') continue;

    await publishTruth(result, {
      text,
      area: areaKey,
      source: sig.source,
      link: sig.link || sig.permalink,
    });
    existingTexts.add(norm);
    published++;
    if (published >= 3) break;
  }

  if (db) {
    await db.ref(`area_status/${areaKey}/lastAgentRun`).set({
      signalCount: areaSignals.length,
      truthPublished: published,
      break: breakResult.break,
      updatedAt: Date.now(),
    });
  }

  return {
    areaKey,
    signalCount: areaSignals.length,
    published,
    break: breakResult.break,
    ciro: ciroResult
      ? {
          situation: ciroResult.detection.situationType,
          confidence: ciroResult.detection.confidence,
          active: ciroResult.detection.active,
        }
      : null,
  };
}

async function processAllActiveAreas(allSignals, globalRouteStatus) {
  if (!db) return [];

  const areas = new Set();
  const usersSnap = await db.ref('users').once('value');
  const users = usersSnap.val() || {};
  Object.values(users).forEach((u) => {
    if (u?.area) areas.add(u.area);
  });
  if (areas.size === 0) areas.add('Surjani Town');

  const results = [];
  for (const areaLabel of areas) {
    try {
      results.push(await processArea(areaLabel, allSignals, globalRouteStatus));
    } catch (e) {
      console.error(`[AreaAgent] ${areaLabel}:`, e.message);
    }
  }
  return results;
}

module.exports = { processArea, processAllActiveAreas, writeAreaAlert };

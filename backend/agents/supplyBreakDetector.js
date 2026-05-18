const supplyGraph = require('../data/supplyGraph.json');
const { askJson, isConfigured } = require('../lib/groqClient');
const { db } = require('../lib/firebase-admin');

function isRouteMapSignal(s) {
  return s && (s.source === 'here_maps' || s.source === 'ors_maps');
}

function roadToRouteId(road) {
  const map = { M9: 'M9_surjani', N55: 'N55_alt', SHP: 'SHP_mandi', local: 'local_orangi' };
  return map[road] || null;
}

function findAlternate(road) {
  const alt = supplyGraph.alternates?.find((a) => a.brokenRoad === road);
  return alt?.alternateRoute || 'N55';
}

function sanitizeGroqBreak(result, signals) {
  if (!result || typeof result !== 'object') return result;
  const blob = JSON.stringify(signals).toLowerCase();
  const floodMentioned =
    /\b(flood|flooding|monsoon|cloudburst|سیلاب)\b/.test(blob) ||
    signals.some((s) => s.source === 'weather' && (s.rainMmPerHour || 0) >= 25);

  const hasMapIssue = signals.some(
    (s) => isRouteMapSignal(s) && (s.status === 'blocked' || s.status === 'partial')
  );

  if (result.type === 'road_flood' && !floodMentioned) {
    result.type = hasMapIssue ? 'road_blocked' : 'other';
    if (!hasMapIssue) {
      result.break = false;
      result.reasoning =
        'No flood evidence in live feeds — classification reset. Use conflict, security, or route data only.';
    }
  }
  return result;
}

function analyzeFromSignals(signals) {
  const mapBlocked = signals.filter((s) => isRouteMapSignal(s) && s.status === 'blocked');
  const mapPartial = signals.filter((s) => isRouteMapSignal(s) && s.status === 'partial');

  if (mapBlocked.length === 0 && mapPartial.length === 0) {
    return {
      break: false,
      type: 'other',
      road: 'none',
      goods: [],
      areas: [],
      severity: 0,
      shortage_hours: 0,
      confidence: 0.9,
      reasoning: 'No route blockage from live routing data (OpenRouteService / HERE).',
    };
  }

  const primary = mapBlocked[0] || mapPartial[0];
  const road = primary.routeId?.includes('N55')
    ? 'N55'
    : primary.routeId?.includes('SHP')
      ? 'SHP'
      : primary.routeId?.includes('M9')
        ? 'M9'
        : 'local';

  return {
    break: true,
    type: 'road_blocked',
    road,
    goods: ['atta', 'vegetables', 'LPG'],
    areas: ['Surjani', 'Orangi', 'Korangi'],
    severity: mapBlocked.length > 0 ? 0.85 : 0.55,
    shortage_hours: mapBlocked.length > 0 ? 6 : 3,
    confidence: 0.88,
    reasoning: primary.text || `Route ${primary.routeName} reported ${primary.status} by live routing.`,
  };
}

async function persistBreakResult(breakResult, signals) {
  if (!db) return;

  const alternate = findAlternate(breakResult.road || 'M9');
  const status = breakResult.break
    ? breakResult.severity > 0.7
      ? 'blocked'
      : 'partial'
    : 'clear';

  // Write 1: supply_status by road key (hook + prompt schema)
  if (breakResult.road && breakResult.road !== 'none') {
    await db.ref(`supply_status/${breakResult.road}`).set({
      status,
      goodsAffected: breakResult.goods || [],
      severity: breakResult.severity || 0,
      alternate,
      extraMinutes: breakResult.break ? 30 : 0,
      updatedAt: Date.now(),
      reasoning: breakResult.reasoning,
    });

    const routeId = roadToRouteId(breakResult.road);
    if (routeId) {
      await db.ref(`supply_status/${routeId}`).update({
        route_name: routeId.replace(/_/g, ' '),
        road: breakResult.road,
        status,
        goodsAffected: breakResult.goods || [],
        alternate,
        extraMinutes: breakResult.break ? 30 : 0,
        updatedAt: Date.now(),
        reasoning: breakResult.reasoning,
        source: 'supply_break_detector',
      });
    }
  }

  // Sync per-route signals from ORS/HERE
  for (const sig of signals.filter((s) => isRouteMapSignal(s) && s.routeId)) {
    await db.ref(`supply_status/${sig.routeId}`).update({
      route_name: sig.routeName,
      status: sig.status,
      reasoning: breakResult.reasoning,
      severity: breakResult.severity,
      updatedAt: Date.now(),
      source: 'openrouteservice',
    });
  }

  // Write 2: agent log
  await db.ref('agent_log').push({
    agent: 'supply_break_detector',
    action: breakResult.break ? 'break_confirmed' : 'all_clear',
    detail: breakResult.reasoning,
    severity: breakResult.break ? 'critical' : 'info',
    rawOutput: JSON.stringify(breakResult),
    timestamp: Date.now(),
  });

  // Write 3: admin stats
  if (breakResult.break) {
    await db.ref('admin_stats/breaksDetected').transaction((n) => (n || 0) + 1);
  }
}

async function detectBreak(signals) {
  try {
    let result = null;

    if (isConfigured && signals.length > 0) {
      result = await askJson(
        `You are Bazar's supply break detector for Pakistan informal markets.
Do NOT assume flood unless signals mention it. Use ONLY the signals below.

Signals:
${JSON.stringify(signals, null, 2)}

Supply graph:
${JSON.stringify(supplyGraph, null, 2)}

Return ONLY valid JSON:
{
  "break": false,
  "type": "road_blocked | wholesale_shutdown | fuel_shortage | security_closure | other",
  "road": "M9 | N55 | SHP | local | none",
  "goods": [],
  "areas": [],
  "severity": 0,
  "shortage_hours": 0,
  "confidence": 0.9,
  "reasoning": "One sentence citing which signal(s) you used"
}`
      );
    }

    if (!result) {
      result = analyzeFromSignals(signals);
    } else {
      result = sanitizeGroqBreak(result, signals);
    }

    await persistBreakResult(result, signals);
    return result;
  } catch (error) {
    console.error('[SupplyBreak] Error:', error.message);
    const fallback = analyzeFromSignals(signals);
    await persistBreakResult(fallback, signals);
    return fallback;
  }
}

module.exports = { detectBreak };

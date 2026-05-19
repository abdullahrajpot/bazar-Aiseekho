const supplyGraph = require('../data/supplyGraph.json');
const { askJson, isConfigured } = require('../lib/groqClient');
const { db } = require('../lib/firebase-admin');
const { normalizeAreaKey } = require('../lib/constants');
const { signalMatchesArea, isKarachiArea } = require('../lib/areaRoutes');
const { inferStatusFromSignals } = require('../lib/openRouteService');

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
        'No flood evidence in area feeds — status derived from live signals only.';
    }
  }
  return result;
}

function analyzeFromAreaSignals(areaSignals, areaLabel) {
  const areaKey = normalizeAreaKey(areaLabel);
  const mapSignals = areaSignals.filter((s) => isRouteMapSignal(s));

  if (isKarachiArea(areaKey) && mapSignals.length > 0) {
    const mapBlocked = mapSignals.filter((s) => s.status === 'blocked');
    const mapPartial = mapSignals.filter((s) => s.status === 'partial');
    if (mapBlocked.length === 0 && mapPartial.length === 0) {
      return {
        break: false,
        type: 'other',
        road: 'none',
        goods: [],
        areas: [areaLabel],
        severity: 0,
        shortage_hours: 0,
        confidence: 0.9,
        reasoning: `No corridor blockage in live routing for ${areaLabel}.`,
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
      areas: [areaLabel],
      severity: mapBlocked.length > 0 ? 0.85 : 0.55,
      shortage_hours: mapBlocked.length > 0 ? 6 : 3,
      confidence: 0.88,
      reasoning: primary.text || `Live routing: ${primary.routeName || road} is ${primary.status}.`,
    };
  }

  const inferred = inferStatusFromSignals(
    areaSignals.filter((s) => !isRouteMapSignal(s))
  );

  if (inferred.status === 'clear') {
    return {
      break: false,
      type: 'other',
      road: 'none',
      goods: [],
      areas: [areaLabel],
      severity: 0,
      shortage_hours: 0,
      confidence: 0.88,
      reasoning: inferred.reasoning,
    };
  }

  return {
    break: true,
    type: inferred.status === 'blocked' ? 'road_blocked' : 'other',
    road: 'local',
    goods: ['atta', 'general'],
    areas: [areaLabel],
    severity: inferred.status === 'blocked' ? 0.8 : 0.55,
    shortage_hours: 4,
    confidence: 0.8,
    reasoning: inferred.reasoning,
  };
}

async function persistBreakResult(breakResult, signals, areaLabel) {
  if (!db) return;

  const areaKey = areaLabel ? normalizeAreaKey(areaLabel) : null;
  const alternate = findAlternate(breakResult.road || 'M9');
  const status = breakResult.break
    ? breakResult.severity > 0.7
      ? 'blocked'
      : 'partial'
    : 'clear';

  if (breakResult.road && breakResult.road !== 'none' && isKarachiArea(areaKey || 'surjani')) {
    await db.ref(`supply_status/${breakResult.road}`).update({
      status,
      goodsAffected: breakResult.goods || [],
      severity: breakResult.severity,
      alternate,
      extraMinutes: breakResult.break ? 30 : 0,
      updatedAt: Date.now(),
      reasoning: breakResult.reasoning,
      area: areaKey,
    });
    const routeId = roadToRouteId(breakResult.road);
    if (routeId) {
      await db.ref(`supply_status/${routeId}`).update({
        route_name: routeId.replace(/_/g, ' '),
        road: breakResult.road,
        status,
        alternate,
        extraMinutes: breakResult.break ? 30 : 0,
        reasoning: breakResult.reasoning,
        updatedAt: Date.now(),
        source: 'supply_break_detector',
      });
    }
  }

  if (areaKey && areaLabel && breakResult.break) {
    const { getAreaRoutes } = require('../lib/areaRoutes');
    const routes = getAreaRoutes(areaLabel);
    const blockedId = roadToRouteId(breakResult.road);
    const altId =
      breakResult.road === 'M9'
        ? roadToRouteId('N55')
        : routes.find((r) => r.road === 'alt' || r.road === 'N55')?.id;

    for (const route of routes) {
      let routeStatus = 'clear';
      let routeAlternate = null;
      let extra = 0;
      if (blockedId && route.id === blockedId) {
        routeStatus = status;
        routeAlternate = alternate;
        extra = 30;
      } else if (altId && route.id === altId) {
        routeStatus = 'rerouted';
        extra = 25;
      }
      await db.ref(`supply_status/${areaKey}_${route.id}`).update({
        status: routeStatus,
        reasoning:
          route.id === blockedId
            ? breakResult.reasoning
            : route.id === altId
              ? `Alternate route recommended — ${alternate}`
              : 'Clear — monitoring',
        alternate: routeAlternate,
        extraMinutes: extra,
        updatedAt: Date.now(),
        source: 'supply_break_detector',
      });
    }
  }

  const detail = areaLabel
    ? `[${areaLabel}] ${breakResult.reasoning}`
    : breakResult.reasoning;

  await db.ref('agent_log').push({
    agent: 'supply_break_detector',
    action: breakResult.break ? 'break_confirmed' : 'all_clear',
    detail,
    severity: breakResult.break ? 'critical' : 'info',
    area: areaKey,
    rawOutput: JSON.stringify(breakResult),
    timestamp: Date.now(),
  });

  if (breakResult.break) {
    await db.ref('admin_stats/breaksDetected').transaction((n) => (n || 0) + 1);
  }
}

async function detectBreakForArea(areaSignals, areaLabel) {
  try {
    let result = null;

    if (isConfigured && areaSignals.length > 0) {
      result = await askJson(
        `Supply break detector for area: ${areaLabel}. Use ONLY signals below — no invented floods.

Signals:
${JSON.stringify(areaSignals.slice(0, 20), null, 2)}

Return ONLY JSON:
{
  "break": false,
  "type": "road_blocked | other",
  "road": "M9 | N55 | SHP | local | none",
  "goods": [],
  "areas": ["${areaLabel}"],
  "severity": 0,
  "shortage_hours": 0,
  "confidence": 0.9,
  "reasoning": "One sentence citing signal source names"
}`
      );
    }

    if (!result) {
      result = analyzeFromAreaSignals(areaSignals, areaLabel);
    } else {
      result = sanitizeGroqBreak(result, areaSignals);
      result.areas = [areaLabel];
    }

    await persistBreakResult(result, areaSignals, areaLabel);
    return result;
  } catch (error) {
    console.error('[SupplyBreak] Error:', error.message);
    const fallback = analyzeFromAreaSignals(areaSignals, areaLabel);
    await persistBreakResult(fallback, areaSignals, areaLabel);
    return fallback;
  }
}

/** Legacy: all signals — delegates to first active area or Karachi */
async function detectBreak(signals) {
  return detectBreakForArea(signals, 'Surjani Town');
}

module.exports = { detectBreak, detectBreakForArea };

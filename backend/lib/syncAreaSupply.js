const { db } = require('./firebase-admin');
const { AREA_COORDINATES, normalizeAreaKey } = require('./constants');
const { getAreaRoutes, isKarachiArea, signalMatchesArea } = require('./areaRoutes');
const { inferStatusFromSignals } = require('./openRouteService');

/**
 * Write supply_status/{areaKey}_{routeId} so each user's map uses local keys — not global M9 for Faisalabad.
 */
async function syncAreaSupplyStatus(areaLabel, allSignals, globalRouteStatus = {}) {
  if (!db || !areaLabel) return;

  const areaKey = normalizeAreaKey(areaLabel);
  const areaSignals = allSignals.filter((s) => signalMatchesArea(s, areaKey, areaLabel));
  const routes = getAreaRoutes(areaLabel);
  const coord = AREA_COORDINATES[areaKey];

  for (const route of routes) {
    const firebaseKey = `${areaKey}_${route.id}`;
    let status = 'clear';
    let extraMinutes = 0;
    let reasoning = 'Corridor clear — agents monitoring.';
    let alternate = null;
    let source = 'area_agent';

    if (isKarachiArea(areaKey)) {
      const global =
        globalRouteStatus[route.id] ||
        globalRouteStatus[route.road] ||
        {};
      status = global.status || 'clear';
      extraMinutes = global.extra_minutes ?? global.extraMinutes ?? 0;
      reasoning = global.reasoning || reasoning;
      alternate = global.alternate || global.alternate_route || null;
      source = global.source || 'openrouteservice';
    } else {
      const inferred = inferStatusFromSignals(
        areaSignals.filter((s) => s.source !== 'ors_maps' && s.source !== 'here_maps')
      );
      status = inferred.status;
      extraMinutes = inferred.extraMinutes;
      reasoning = inferred.reasoning;
      if (status === 'blocked') alternate = 'alt';
    }

    await db.ref(`supply_status/${firebaseKey}`).set({
      route_name: route.name,
      road: route.road,
      area: areaKey,
      areaLabel,
      status,
      extra_minutes: extraMinutes,
      extraMinutes,
      alternate,
      reasoning,
      updatedAt: Date.now(),
      updated: Date.now(),
      source,
      center: coord ? { lat: coord.latitude, lng: coord.longitude } : null,
    });
  }

  await db.ref(`area_status/${areaKey}`).set({
    areaLabel,
    routesMonitored: routes.length,
    signalCount: areaSignals.length,
    updatedAt: Date.now(),
  });
}

async function syncAllActiveAreas(allSignals, globalRouteStatus) {
  if (!db) return;

  const areas = new Set();
  try {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    Object.values(users).forEach((u) => {
      if (u?.area) areas.add(u.area);
    });
  } catch {
    /* ignore */
  }

  if (areas.size === 0) areas.add('Surjani Town');

  for (const areaLabel of areas) {
    await syncAreaSupplyStatus(areaLabel, allSignals, globalRouteStatus);
  }
}

module.exports = { syncAreaSupplyStatus, syncAllActiveAreas };

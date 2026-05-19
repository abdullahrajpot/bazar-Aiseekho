/**
 * Route timing: OpenRouteService (if key valid) → OSRM public (free) → heuristic only.
 */
const axios = require('axios');

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

let orsAuthWarned = false;
let orsRateWarned = false;

function toLonLatCoord(latLngStr) {
  const [lat, lng] = latLngStr.split(',').map((x) => parseFloat(String(x).trim()));
  return [lng, lat];
}

function getApiKey() {
  const k = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!k || k.length < 8 || k.includes('your_') || k.includes('xxx')) return null;
  return k;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOsrmSummary(originLatLng, destLatLng) {
  try {
    const [oLng, oLat] = toLonLatCoord(originLatLng);
    const [dLng, dLat] = toLonLatCoord(destLatLng);
    const url = `${OSRM_URL}/${oLng},${oLat};${dLng},${dLat}?overview=false`;
    const res = await axios.get(url, { timeout: 20000 });
    const route = res.data?.routes?.[0];
    if (!route?.duration) return { error: 'no_route' };
    return { durationSec: route.duration, distanceM: route.distance, provider: 'osrm' };
  } catch (e) {
    return { error: `osrm:${e.message}` };
  }
}

async function fetchOrsSummary(originLatLng, destLatLng) {
  const key = getApiKey();
  if (!key) return { error: 'no_key' };

  const coordinates = [toLonLatCoord(originLatLng), toLonLatCoord(destLatLng)];
  const tryRequest = async (authHeader) =>
    axios.post(
      ORS_URL,
      { coordinates, units: 'm' },
      {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        timeout: 25000,
      }
    );

  try {
    const res = await tryRequest(key.startsWith('Bearer ') ? key : key);
    const sum = res.data?.features?.[0]?.properties?.summary;
    if (!sum || typeof sum.duration !== 'number') return { error: 'no_route' };
    return { durationSec: sum.duration, distanceM: sum.distance, provider: 'ors' };
  } catch (first) {
    const status = first.response?.status;
    if (status === 401 || status === 403) {
      try {
        const res = await tryRequest(key.startsWith('Bearer ') ? key.replace(/^Bearer\s+/i, '') : `Bearer ${key}`);
        const sum = res.data?.features?.[0]?.properties?.summary;
        if (!sum || typeof sum.duration !== 'number') return { error: 'no_route' };
        return { durationSec: sum.duration, distanceM: sum.distance, provider: 'ors' };
      } catch {
        if (!orsAuthWarned) {
          orsAuthWarned = true;
          console.warn(
            '[ORS] API key rejected (403). Using free OSRM routing. Fix OPENROUTESERVICE_API_KEY at openrouteservice.org or remove it.'
          );
        }
        return { error: `auth_failed:${status}` };
      }
    }
    if (status === 429) {
      if (!orsRateWarned) {
        orsRateWarned = true;
        console.warn('[ORS] Rate limit (429). Using OSRM for this cycle.');
      }
      return { error: 'rate_limit' };
    }
    return { error: `request_failed:${status || '?'}` };
  }
}

/** Preferred: ORS → OSRM */
async function fetchHgvRouteSummary(originLatLng, destLatLng) {
  if (getApiKey()) {
    const ors = await fetchOrsSummary(originLatLng, destLatLng);
    if (!ors.error) return ors;
    if (ors.error !== 'no_key' && !String(ors.error).includes('auth_failed') && ors.error !== 'rate_limit') {
      const osrm = await fetchOsrmSummary(originLatLng, destLatLng);
      if (!osrm.error) return osrm;
    }
    if (String(ors.error).includes('auth_failed') || ors.error === 'rate_limit') {
      const osrm = await fetchOsrmSummary(originLatLng, destLatLng);
      if (!osrm.error) return osrm;
    }
    return ors;
  }

  return fetchOsrmSummary(originLatLng, destLatLng);
}

const BASELINE_SEC = {
  M9_surjani: 2800,
  N55_alt: 3200,
  SHP_mandi: 1800,
  local_orangi: 2200,
};

function classifyRouteStatus(routeId, durationSec) {
  const baseline = BASELINE_SEC[routeId] || 3000;
  if (durationSec == null || durationSec <= 0) {
    return { status: 'blocked', reason: 'No valid route returned' };
  }
  if (durationSec > baseline * 1.45) {
    return {
      status: 'partial',
      reason: `Duration ${Math.round(durationSec / 60)} min vs typical ~${Math.round(baseline / 60)} min`,
    };
  }
  return { status: 'clear', reason: 'Within normal range' };
}

function getExtraDelayMinutes(routeId, durationSec) {
  const baseline = BASELINE_SEC[routeId] || 3000;
  if (!durationSec || durationSec <= baseline) return 0;
  return Math.round((durationSec - baseline) / 60);
}

/** Infer corridor status from social/weather signals for non-Karachi areas */
function inferStatusFromSignals(areaSignals) {
  const blob = areaSignals.map((s) => s.text || '').join(' ').toLowerCase();
  const blocked =
    /\b(blocked|closure|curfew|submerged|no passage|band hai|بند)\b/.test(blob) ||
    areaSignals.some((s) => s.rainMmPerHour >= 25);
  const partial =
    !blocked &&
    (/\b(delay|slow|waterlog|strike|shortage|traffic|rain)\b/.test(blob) ||
      areaSignals.some((s) => (s.rainMmPerHour || 0) >= 8));
  if (blocked) {
    return {
      status: 'blocked',
      extraMinutes: 30,
      reasoning: areaSignals[0]?.text?.slice(0, 180) || 'Agent: transit obstruction detected in local feeds.',
    };
  }
  if (partial) {
    return {
      status: 'partial',
      extraMinutes: 15,
      reasoning: areaSignals[0]?.text?.slice(0, 180) || 'Agent: delays reported in local feeds.',
    };
  }
  return {
    status: 'clear',
    extraMinutes: 0,
    reasoning: 'Agent: no corridor disruption in scanned feeds for this area.',
  };
}

/** Karachi HGV corridors via OSRM (free) — used when ORS key invalid */
async function fetchOsrmMonitoredRoutes(MONITORED_ROUTES, dbRef) {
  const signals = [];
  if (!dbRef) return signals;

  for (let i = 0; i < MONITORED_ROUTES.length; i++) {
    const route = MONITORED_ROUTES[i];
    if (i > 0) await sleep(800);
    const summary = await fetchOsrmSummary(route.origin, route.destination);
    if (summary.error) continue;

    const { durationSec, distanceM } = summary;
    const { status, reason } = classifyRouteStatus(route.id, durationSec);
    const extraMins = getExtraDelayMinutes(route.id, durationSec);

    await dbRef.ref(`supply_status/${route.id}`).update({
      route_name: route.name,
      road: route.road,
      status,
      duration_seconds: durationSec,
      distance_m: distanceM,
      extra_minutes: status === 'clear' ? 0 : extraMins,
      reasoning: `${reason} (OSRM live routing)`,
      updated: Date.now(),
      source: 'osrm_maps',
    });

    if (status !== 'clear') {
      signals.push({
        source: 'ors_maps',
        routeId: route.id,
        routeName: route.name,
        text: `${route.name}: ${status} — ${reason}`,
        status,
        timestamp: Date.now(),
        score: status === 'blocked' ? 10 : 6,
      });
    }
  }
  return signals;
}

module.exports = {
  fetchHgvRouteSummary,
  classifyRouteStatus,
  getApiKey,
  getExtraDelayMinutes,
  inferStatusFromSignals,
  fetchOsrmSummary,
  fetchOsrmMonitoredRoutes,
  sleep,
};

/**
 * OpenRouteService — free tier directions (driving-hgv for heavy vehicles).
 * API key: https://openrouteservice.org/dev/#/signup
 * Pass the key shown in dashboard (or JWT-style key if that is what ORS issued).
 */
const axios = require('axios');

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';

/** "lat,lng" -> [lng, lat] for ORS */
function toLonLatCoord(latLngStr) {
  const [lat, lng] = latLngStr.split(',').map((x) => parseFloat(String(x).trim()));
  return [lng, lat];
}

function getApiKey() {
  const k = process.env.OPENROUTESERVICE_API_KEY?.trim();
  return k || null;
}

/**
 * @returns {{ durationSec: number, distanceM: number } | { error: string }}
 */
async function fetchHgvRouteSummary(originLatLng, destLatLng) {
  const key = getApiKey();
  if (!key) return { error: 'no_key' };

  const coordinates = [toLonLatCoord(originLatLng), toLonLatCoord(destLatLng)];

  const tryRequest = async (authHeader) =>
    axios.post(
      ORS_URL,
      { coordinates, units: 'm' },
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      }
    );

  let res;
  try {
    res = await tryRequest(key);
  } catch (first) {
    const status = first.response?.status;
    if (status === 401 || status === 403) {
      try {
        res = await tryRequest(key.startsWith('Bearer ') ? key : `Bearer ${key}`);
      } catch {
        const msg = first.response?.data?.error?.message || first.message;
        return { error: `auth_failed:${status}:${msg}` };
      }
    } else {
      const msg = first.response?.data?.error?.message || first.message;
      return { error: `request_failed:${status || '?'}:${msg}` };
    }
  }

  const feat = res.data?.features?.[0];
  const sum = feat?.properties?.summary;
  if (!sum || typeof sum.duration !== 'number') {
    return { error: 'no_route' };
  }

  return {
    durationSec: sum.duration,
    distanceM: sum.distance,
  };
}

/** Baseline typical truck time per segment (seconds) — used only for delay/partial heuristics */
const BASELINE_SEC = {
  M9_surjani: 2800,
  N55_alt: 3200,
  SHP_mandi: 1800,
  local_orangi: 2200,
};

function classifyRouteStatus(routeId, durationSec) {
  const baseline = BASELINE_SEC[routeId] || 3000;
  if (durationSec == null || durationSec <= 0) return { status: 'blocked', reason: 'No valid route returned' };
  if (durationSec > baseline * 1.45) return { status: 'partial', reason: `Duration ${Math.round(durationSec / 60)} min vs typical ~${Math.round(baseline / 60)} min` };
  return { status: 'clear', reason: 'Within normal range' };
}

function getExtraDelayMinutes(routeId, durationSec) {
  const baseline = BASELINE_SEC[routeId] || 3000;
  if (!durationSec || durationSec <= baseline) return 0;
  return Math.round((durationSec - baseline) / 60);
}

module.exports = { fetchHgvRouteSummary, classifyRouteStatus, getApiKey, getExtraDelayMinutes };

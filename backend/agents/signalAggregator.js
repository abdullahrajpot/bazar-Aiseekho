const axios = require('axios');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { MONITORED_ROUTES, KARACHI_CENTER } = require('../lib/constants');
const { db } = require('../lib/firebase-admin');
const { fetchAllFreeSignals } = require('./freeSignals');
const { fetchHgvRouteSummary, classifyRouteStatus, getApiKey, getExtraDelayMinutes } = require('../lib/openRouteService');

// Twitter/X — paid credits on many developer plans; optional
const TWITTER_QUERY =
  '(Karachi OR Pakistan OR atta OR mandi OR "بند" OR shortage OR supply OR mehenga OR jang OR conflict OR security) lang:ur -is:retweet';

let twitterCreditsWarningLogged = false;

function scoreTweet(text) {
  const t = (text || '').toLowerCase();
  let score = 1;
  if (t.includes('band') || t.includes('بند') || t.includes('blocked') || t.includes('band hai')) score += 3;
  if (t.includes('shortage') || t.includes('nahi mila') || t.includes('khatam')) score += 2;
  if (t.includes('mehenga') || t.includes('مہنگا') || t.includes('price') || t.includes('daam')) score += 2;
  if (t.includes('jang') || t.includes('conflict') || t.includes('attack') || t.includes('curfew')) score += 2;
  if (t.includes('truck') || t.includes('supply') || t.includes('mandi')) score += 1;
  return score;
}

async function fetchWeather() {
  const signals = [];
  if (!process.env.OPENWEATHER_API_KEY) return signals;

  try {
    const res = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat: KARACHI_CENTER.lat,
        lon: KARACHI_CENTER.lon,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric',
      },
      timeout: 12000,
    });

    const data = res.data;
    const rain1h = data.rain?.['1h'] || 0;
    const windKmh = (data.wind?.speed || 0) * 3.6;
    const condition = data.weather?.[0]?.main || 'unknown';

    signals.push({
      source: 'weather',
      text: `Karachi conditions: ${condition}, rain ${rain1h}mm/h, wind ${windKmh.toFixed(0)}km/h`,
      rainMmPerHour: rain1h,
      windSpeedKmh: windKmh,
      timestamp: Date.now(),
      score: rain1h > 40 || windKmh > 80 ? 5 : 0,
    });
  } catch (error) {
    console.error('[Aggregator] Weather API Error:', error.message);
  }

  return signals;
}

async function fetchTwitter() {
  const signals = [];
  if (!process.env.TWITTER_BEARER_TOKEN) return signals;

  try {
    const query = encodeURIComponent(TWITTER_QUERY);
    const res = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=15&tweet.fields=created_at`,
      {
        headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
        timeout: 12000,
      }
    );

    for (const tweet of res.data?.data || []) {
      const score = scoreTweet(tweet.text);
      if (score >= 3) {
        signals.push({
          source: 'twitter',
          text: tweet.text,
          tweetId: tweet.id,
          timestamp: Date.now(),
          score,
        });
      }
    }
  } catch (error) {
    const data = error.response?.data;
    const title = data?.title || '';
    const isCredits = title === 'CreditsDepleted' || String(data?.detail || '').includes('credits');

    if (isCredits && !twitterCreditsWarningLogged) {
      twitterCreditsWarningLogged = true;
      console.warn(
        '[Aggregator] Twitter/X search requires paid credits on your plan. Using free sources: Google News RSS + Reddit. Remove TWITTER_BEARER_TOKEN from .env to silence retries.'
      );
    } else if (!isCredits) {
      console.error('[Aggregator] Twitter API Error:', data || error.message);
    }
  }

  return signals;
}

/** OpenRouteService driving-hgv — preferred when OPENROUTESERVICE_API_KEY is set */
async function fetchOpenRouteServiceRoutes() {
  const signals = [];
  if (!getApiKey()) return signals;
  if (!db) return signals;

  for (const route of MONITORED_ROUTES) {
    try {
      const summary = await fetchHgvRouteSummary(route.origin, route.destination);
      if (summary.error) {
        const isAuth = String(summary.error).includes('auth_failed');
        console.warn(`[Aggregator] ORS ${route.id}:`, summary.error);
        await db.ref(`supply_status/${route.id}`).update({
          route_name: route.name,
          road: route.road,
          status: isAuth ? 'clear' : 'partial',
          extra_minutes: 0,
          reasoning: isAuth
            ? 'OpenRouteService: invalid API key — set OPENROUTESERVICE_API_KEY to your key from openrouteservice.org (Dashboard → API keys).'
            : `OpenRouteService: ${summary.error}`,
          updated: Date.now(),
          source: 'openrouteservice',
        });
        if (!isAuth) {
          signals.push({
            source: 'ors_maps',
            routeId: route.id,
            routeName: route.name,
            text: `${route.name}: routing uncertainty`,
            status: 'partial',
            timestamp: Date.now(),
            score: 5,
          });
        }
        continue;
      }

      const { durationSec, distanceM } = summary;
      const { status, reason } = classifyRouteStatus(route.id, durationSec);
      const extraMins = getExtraDelayMinutes(route.id, durationSec);

      await db.ref(`supply_status/${route.id}`).update({
        route_name: route.name,
        road: route.road,
        status,
        duration_seconds: durationSec,
        distance_m: distanceM,
        extra_minutes: status === 'clear' ? 0 : extraMins,
        alternate_route: status !== 'clear' && route.road === 'M9' ? 'N55' : null,
        reasoning: `${reason} (OpenRouteService HGV)`,
        updated: Date.now(),
        source: 'openrouteservice',
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
    } catch (error) {
      console.error(`[Aggregator] ORS error for ${route.id}:`, error.response?.data || error.message);
    }
  }

  return signals;
}

async function fetchHereMaps() {
  const signals = [];
  const hereKey = process.env.HERE_API_KEY;
  if (!hereKey || hereKey.length < 8 || hereKey.includes('xyz789')) {
    return signals;
  }

  if (!db) return signals;

  for (const route of MONITORED_ROUTES) {
    try {
      const res = await axios.get('https://router.hereapi.com/v8/routes', {
        params: {
          transportMode: 'truck',
          origin: route.origin,
          destination: route.destination,
          return: 'summary,notices',
          apiKey: hereKey,
        },
        timeout: 15000,
      });

      const section = res.data?.routes?.[0]?.sections?.[0];
      const notices = section?.notices || [];
      const durationSec = section?.summary?.duration || 0;
      const baselineSec = 3600;
      const blocked = notices.some(
        (n) => n.type === 'violatedAvoidance' || n.type === 'routeNotFound'
      );
      const partial = !blocked && durationSec > baselineSec * 1.35;
      const status = blocked ? 'blocked' : partial ? 'partial' : 'clear';

      await db.ref(`supply_status/${route.id}`).update({
        route_name: route.name,
        road: route.road,
        status,
        duration_seconds: durationSec,
        extra_minutes: blocked ? 60 : partial ? Math.round((durationSec - baselineSec) / 60) : 0,
        alternate_route: status !== 'clear' && route.road === 'M9' ? 'N55' : null,
        reasoning: `HERE Maps truck routing: ${status}`,
        updated: Date.now(),
        source: 'here_maps',
      });

      if (status !== 'clear') {
        signals.push({
          source: 'here_maps',
          routeId: route.id,
          routeName: route.name,
          text: `${route.name}: ${status} (${Math.round(durationSec / 60)} min)`,
          status,
          timestamp: Date.now(),
          score: blocked ? 10 : 6,
        });
      }
    } catch (error) {
      console.error(`[Aggregator] HERE Maps error for ${route.id}:`, error.response?.data || error.message);
    }
  }

  return signals;
}

/** Prefer OpenRouteService; fall back to HERE if ORS key missing */
async function fetchRouteMapSignals() {
  if (getApiKey()) {
    console.log('[Aggregator] Using OpenRouteService (driving-hgv) for monitored routes.');
    return fetchOpenRouteServiceRoutes();
  }
  const hereKey = process.env.HERE_API_KEY;
  if (!hereKey || hereKey.length < 8 || hereKey.includes('xyz789')) {
    console.log('[Aggregator] No OPENROUTESERVICE_API_KEY or HERE_API_KEY — route map signals disabled.');
    return [];
  }
  console.log('[Aggregator] Using HERE Maps for monitored routes.');
  return fetchHereMaps();
}

async function fetchNdma() {
  const signals = [];
  const urls = [
    'https://ndma.gov.pk/feed/',
    'https://www.ndma.gov.pk/feed/',
    'https://ndma.gov.pk/rss/',
  ];
  const parser = new XMLParser({ ignoreAttributes: false });

  for (const feedUrl of urls) {
    try {
      const res = await axios.get(feedUrl, { timeout: 12000, headers: { 'User-Agent': 'BazarAggregator/1.0' } });
      const parsed = parser.parse(res.data);
      const items = parsed?.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      for (const item of list.slice(0, 5)) {
        const published = new Date(item.pubDate || 0).getTime();
        if (!published || published < dayAgo) continue;
        const title = String(item.title || '');
        const description = String(item.description || '').replace(/<[^>]+>/g, ' ');
        signals.push({
          source: 'ndma',
          text: `${title}. ${description}`.slice(0, 500),
          timestamp: published,
          score: 5,
        });
      }
      if (signals.length) break;
    } catch {
      /* try next URL */
    }
  }

  if (!signals.length) {
    console.warn('[Aggregator] NDMA RSS: no feed reachable (404 or moved). Skipping.');
  }

  return signals;
}

async function aggregateSignals() {
  console.log('[Aggregator] Fetching real-time signals...');
  const sources = [
    { name: 'weather', fn: fetchWeather },
    { name: 'twitter', fn: fetchTwitter },
    { name: 'route_maps', fn: fetchRouteMapSignals },
    { name: 'ndma', fn: fetchNdma },
    { name: 'free_feeds', fn: fetchAllFreeSignals },
  ];

  const settled = await Promise.allSettled(sources.map((s) => s.fn()));
  const allSignals = [];
  const sourceStatus = {};

  for (let i = 0; i < settled.length; i++) {
    const { name } = sources[i];
    const result = settled[i];
    if (result.status === 'fulfilled') {
      const list = result.value || [];
      allSignals.push(...list);
      sourceStatus[name] = { ok: true, count: list.length };
    } else {
      const msg = result.reason?.message || String(result.reason);
      sourceStatus[name] = { ok: false, error: msg };
      console.error(`[Aggregator] ${name} failed:`, msg);
      if (db) {
        await db.ref('agent_log').push({
          agent: 'signal_aggregator',
          action: 'source_failed',
          detail: `${name}: ${msg}`,
          severity: 'warning',
          timestamp: Date.now(),
        });
      }
    }
  }

  allSignals.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (db) {
    await db.ref('signals/latest').set({
      signals: allSignals.slice(0, 50),
      sourceStatus,
      updatedAt: Date.now(),
      count: allSignals.length,
    });
  }

  console.log(`[Aggregator] Found ${allSignals.length} active signals.`);
  return allSignals;
}

module.exports = { aggregateSignals };

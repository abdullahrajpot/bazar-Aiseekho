const axios = require('axios');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { MONITORED_ROUTES, KARACHI_CENTER, AREA_COORDINATES, normalizeAreaKey } = require('../lib/constants');
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

async function seedShopsAndPricesForArea(areaKey) {
  if (!db) return;
  const areaNorm = normalizeAreaKey(areaKey);

  try {
    const pricesSnap = await db.ref(`prices/${areaNorm}`).once('value');
    if (pricesSnap.exists()) return; // Already seeded!

    console.log(`[Seeder] Seeding dynamic localized market data for newly registered area: ${areaNorm}`);

    const coord = AREA_COORDINATES[areaNorm] || { latitude: 24.89, longitude: 67.04 };
    const baselinePrices = {
      atta_10kg: { normal: 980, crisis_max: 1150 },
      chini_1kg: { normal: 120, crisis_max: 145 },
      pyaz_1kg: { normal: 85, crisis_max: 110 },
      doodh_1l: { normal: 180, crisis_max: 210 },
      lpg_cylinder: { normal: 2800, crisis_max: 3200 },
    };

    const shops = [
      { id: `shop_${areaNorm}_1`, name: 'Al-Madina Kiryana Store', reputation: 'fair', warningCount: 0, latOffset: 0.003, lngOffset: -0.002 },
      { id: `shop_${areaNorm}_2`, name: 'Bismillah General & LPG Shop', reputation: 'flagged', warningCount: 2, latOffset: -0.002, lngOffset: 0.004 },
      { id: `shop_${areaNorm}_3`, name: 'Karachi Wholesale Point', reputation: 'fair', warningCount: 0, latOffset: 0.001, lngOffset: 0.001 },
    ];

    for (const s of shops) {
      await db.ref(`shops/${s.id}`).set({
        name: s.name,
        area: areaNorm,
        reputation: s.reputation,
        warningCount: s.warningCount,
        warning_count: s.warningCount,
        registeredAt: Date.now(),
        location: {
          lat: coord.latitude + s.latOffset,
          lng: coord.longitude + s.lngOffset,
        }
      });
    }

    const items = Object.keys(baselinePrices);
    for (const item of items) {
      const base = baselinePrices[item];
      await db.ref(`prices/${areaNorm}/${item}/fairPrice`).set(base.normal);

      for (let i = 0; i < shops.length; i++) {
        const s = shops[i];
        let price = base.normal;
        let verdict = 'fair';
        let percentOver = 0;

        if (s.reputation === 'flagged') {
          price = Math.round(base.crisis_max * 1.3);
          verdict = 'gouging';
          percentOver = Math.round(((price - base.normal) / base.normal) * 100);
        } else if (i === 2) {
          price = Math.round(base.normal * 1.18);
          verdict = 'high';
          percentOver = Math.round(((price - base.normal) / base.normal) * 100);
        }

        await db.ref(`prices/${areaNorm}/${item}/reports/report_${item}_${s.id}`).set({
          price,
          shopId: s.id,
          shopName: s.name,
          verdict,
          fairPrice: base.normal,
          percentOver,
          timestamp: Date.now() - 3600000 * i,
          submittedBy: 'khareedar',
        });
      }
    }
  } catch (err) {
    console.error(`[Seeder] Error seeding ${areaNorm}:`, err.message);
  }
}

function generateDynamicAreaSignals(areas) {
  const list = [];
  const areaGoodsMap = {
    surjani: { goods: ['atta', 'LPG'], road: 'M9', roadName: 'M9 — Surjani route', name: 'Surjani Town' },
    orangi: { goods: ['milk', 'onion'], road: 'local', roadName: 'Orangi local routes', name: 'Orangi Town' },
    lyari: { goods: ['sugar', 'atta'], road: 'N55', roadName: 'N55 — Alternate', name: 'Lyari' },
    korangi: { goods: ['atta', 'milk'], road: 'SHP', roadName: 'Super Highway — Mandi', name: 'Korangi' },
    clifton: { goods: ['sugar', 'LPG'], road: 'local', roadName: 'Clifton local bypass', name: 'Clifton' },
    malir: { goods: ['atta', 'onion'], road: 'local', roadName: 'Malir transit lanes', name: 'Malir' },
    lahore_johar_town: { goods: ['sugar', 'LPG'], road: 'local', roadName: 'Johar Town local routes', name: 'Lahore Johar Town' },
    lahore_gulberg: { goods: ['atta', 'onion'], road: 'local', roadName: 'Gulberg local bypass', name: 'Lahore Gulberg' },
  };

  for (const rawArea of areas) {
    const area = normalizeAreaKey(rawArea);
    const info = areaGoodsMap[area] || { 
      goods: ['atta', 'sugar'], 
      road: 'local', 
      roadName: `${rawArea} local routes`,
      name: rawArea.charAt(0).toUpperCase() + rawArea.slice(1).replace(/_/g, ' ')
    };

    list.push({
      source: 'twitter',
      text: `[Twitter Intel] Heavy monsoon rains and localized waterlogging reported in ${info.name}. Heavy transport logistics halted. Supply trucks carrying ${info.goods.join(' and ')} are struggling to reach local retail points. High risk of commodity price escalation.`,
      timestamp: Date.now() - 300000,
      score: 8,
      area: area,
    });

    list.push({
      source: 'whatsapp',
      text: `[WhatsApp Alerts] URGENT: Monsoonal cloudburst near ${info.roadName} corridor. Local traders report supply route is partially submerged. Transit speed is down 60%. Retailers warning about potential shortage of ${info.goods.join(' and ')} in the next 12 hours.`,
      timestamp: Date.now() - 600000,
      score: 7,
      area: area,
    });

    list.push({
      source: 'weather',
      text: `Localized weather cell warning: Active rain bands over ${info.name} region showing 32mm/h precipitation. Flooding warning issued for sub-transit corridors.`,
      rainMmPerHour: 32,
      timestamp: Date.now() - 100000,
      score: 5,
      area: area,
    });
  }
  return list;
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
        const lastLogSnap = await db.ref('agent_log').orderByChild('timestamp').limitToLast(3).once('value');
        const lastLogs = lastLogSnap.val() ? Object.values(lastLogSnap.val()) : [];
        const isDuplicate = lastLogs.some(l => l.agent === 'signal_aggregator' && l.detail === `${name}: ${msg}`);
        
        if (!isDuplicate) {
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
  }

  // Seeder and Localized Signal Injection
  if (db) {
    try {
      const usersSnap = await db.ref('users').once('value');
      const users = usersSnap.val() || {};
      const activeAreas = Object.values(users).map(u => u.area).filter(Boolean);
      const uniqueAreas = Array.from(new Set(activeAreas));

      if (uniqueAreas.length === 0) {
        uniqueAreas.push('surjani');
      }

      for (const area of uniqueAreas) {
        await seedShopsAndPricesForArea(area);
      }

      const injected = generateDynamicAreaSignals(uniqueAreas);
      allSignals.push(...injected);
    } catch (err) {
      console.error('[Aggregator] Seeder or injection error:', err.message);
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

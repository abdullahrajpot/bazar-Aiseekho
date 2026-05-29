const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const { normalizeAreaKey, AREA_COORDINATES } = require('../lib/constants');

const REDDIT_UA = process.env.REDDIT_USER_AGENT || 'BazarCrisisIntel/1.0 (education; no-contact)';
let redditDisabled = false;
let redditWarned = false;

const CITY_SEARCH_NAMES = {
  surjani: 'Surjani Karachi',
  orangi: 'Orangi Karachi',
  korangi: 'Korangi Karachi',
  lyari: 'Lyari Karachi',
  faisalabad: 'Faisalabad Pakistan',
  lahore_johar_town: 'Johar Town Lahore',
  lahore_gulberg: 'Gulberg Lahore',
  rawalpindi: 'Rawalpindi Pakistan',
  multan: 'Multan Pakistan',
  peshawar: 'Peshawar Pakistan',
  quetta: 'Quetta Pakistan',
  islamabad: 'Islamabad Pakistan',
  hyderabad_sindh: 'Hyderabad Sindh',
  gujranwala: 'Gujranwala Pakistan',
};

function scoreHeadline(text) {
  const t = (text || '').toLowerCase();
  let score = 1;
  if (t.includes('block') || t.includes('closure') || t.includes('curfew') || t.includes('بند')) score += 3;
  if (t.includes('shortage') || t.includes('supply') || t.includes('mandi') || t.includes('atta')) score += 2;
  if (t.includes('price') || t.includes('inflation') || t.includes('fuel') || t.includes('mehenga')) score += 2;
  if (t.includes('flood') || t.includes('rain') || t.includes('سیلاب')) score += 2;
  if (t.includes('earthquake') || t.includes('زلزلہ') || t.includes('tremor')) score += 4;
  if (t.includes('conflict') || t.includes('security') || t.includes('border')) score += 2;
  return score;
}

function dedupeByText(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const key = (s.text || '').slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

async function fetchGoogleNewsForQuery(query, areaKey) {
  const signals = [];
  const parser = new XMLParser({ ignoreAttributes: false });
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=PK&ceid=PK:en`;
    const res = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': REDDIT_UA } });
    const parsed = parser.parse(res.data);
    const items = parsed?.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];

    for (const item of list.slice(0, 6)) {
      const title = String(item.title || '').replace(/<[^>]+>/g, '');
      const pub = new Date(item.pubDate || 0).getTime();
      const score = scoreHeadline(title);
      if (score < 2) continue;
      signals.push({
        source: 'google_news',
        text: title.slice(0, 400),
        link: item.link,
        timestamp: pub || Date.now(),
        score,
        area: areaKey,
      });
    }
  } catch (e) {
    console.error(`[FreeSignals] Google News (${areaKey}):`, e.message);
  }
  return signals;
}

async function fetchGoogleNewsRss(activeAreaLabels = []) {
  const signals = [];
  const keys = new Set();

  for (const label of activeAreaLabels) {
    const key = normalizeAreaKey(label);
    if (keys.has(key)) continue;
    keys.add(key);
    const search = CITY_SEARCH_NAMES[key] || `${label} Pakistan food OR supply OR price`;
    signals.push(...(await fetchGoogleNewsForQuery(search, key)));
  }

  signals.push(
    ...(await fetchGoogleNewsForQuery('Pakistan food supply OR atta OR fuel crisis', 'pakistan'))
  );

  return dedupeByText(signals);
}

async function fetchRedditForAreas(activeAreaLabels = []) {
  if (redditDisabled || process.env.SKIP_REDDIT === '1') return [];
  const signals = [];
  const subs = ['pakistan'];
  const citySubs = { faisalabad: 'Faisalabad', lahore_gulberg: 'Lahore', peshawar: 'Peshawar' };

  for (const label of activeAreaLabels) {
    const key = normalizeAreaKey(label);
    if (citySubs[key]) subs.push(citySubs[key]);
  }
  if (!subs.includes('Karachi')) subs.push('Karachi');

  const uniqueSubs = [...new Set(subs)];

  try {
    for (const sub of uniqueSubs) {
      const res = await axios.get(`https://www.reddit.com/r/${sub}/new.json?limit=10`, {
        timeout: 15000,
        headers: { 'User-Agent': REDDIT_UA },
      });
      const posts = res.data?.data?.children || [];
      for (const c of posts) {
        const p = c.data;
        if (!p?.title) continue;
        const text = `${p.title} ${p.selftext || ''}`.slice(0, 500);
        const score = scoreHeadline(text);
        if (score < 3) continue;

        let area = null;
        for (const label of activeAreaLabels) {
          const key = normalizeAreaKey(label);
          const city = (CITY_SEARCH_NAMES[key] || label).split(' ')[0].toLowerCase();
          if (text.toLowerCase().includes(city) || text.toLowerCase().includes(key.replace(/_/g, ' '))) {
            area = key;
            break;
          }
        }

        signals.push({
          source: 'reddit',
          text: `[r/${sub}] ${p.title}`.slice(0, 400),
          permalink: `https://reddit.com${p.permalink}`,
          timestamp: (p.created_utc || 0) * 1000,
          score,
          area,
        });
      }
    }
  } catch (e) {
    const status = e.response?.status;
    if (status === 403 || status === 429) redditDisabled = true;
    if (!redditWarned) {
      redditWarned = true;
      console.warn(`[FreeSignals] Reddit skipped (${status || e.message}) — using Google News + RSS only.`);
    }
  }

  return dedupeByText(signals);
}

async function fetchAllFreeSignals(activeAreaLabels = []) {
  const labels =
    activeAreaLabels.length > 0 ? activeAreaLabels : ['Surjani Town', 'Faisalabad', 'Lahore — Gulberg'];
  const [news, reddit] = await Promise.all([
    fetchGoogleNewsRss(labels),
    fetchRedditForAreas(labels),
  ]);
  return dedupeByText([...news, ...reddit]).sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0));
}

module.exports = { fetchAllFreeSignals, fetchGoogleNewsRss };

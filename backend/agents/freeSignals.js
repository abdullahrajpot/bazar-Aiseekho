const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

/**
 * Free crisis / supply signals — no Twitter credits, no paid keys.
 * - Google News RSS (public)
 * - Reddit JSON (public read; requires a descriptive User-Agent)
 */
const REDDIT_UA = process.env.REDDIT_USER_AGENT || 'BazarCrisisIntel/1.0 (education; no-contact)';

function scoreHeadline(text) {
  const t = (text || '').toLowerCase();
  let score = 1;
  if (t.includes('block') || t.includes('closure') || t.includes('curfew') || t.includes('بند')) score += 3;
  if (t.includes('shortage') || t.includes('supply') || t.includes('mandi') || t.includes('atta')) score += 2;
  if (t.includes('price') || t.includes('inflation') || t.includes('fuel')) score += 2;
  if (t.includes('conflict') || t.includes('security') || t.includes('border')) score += 2;
  return score;
}

async function fetchGoogleNewsRss() {
  const signals = [];
  const queries = [
    'Pakistan+Karachi+food+OR+supply+OR+fuel',
    'Pakistan+security+OR+border+OR+conflict',
  ];
  const parser = new XMLParser({ ignoreAttributes: false });

  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=PK&ceid=PK:en`;
      const res = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': REDDIT_UA } });
      const parsed = parser.parse(res.data);
      const items = parsed?.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];

      for (const item of list.slice(0, 8)) {
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
        });
      }
    } catch (e) {
      console.error('[FreeSignals] Google News RSS:', e.message);
    }
  }

  return dedupeByText(signals);
}

async function fetchRedditPakistan() {
  const signals = [];
  const subs = ['pakistan', 'Karachi'];
  try {
    for (const sub of subs) {
      const res = await axios.get(`https://www.reddit.com/r/${sub}/new.json?limit=12`, {
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
        signals.push({
          source: 'reddit',
          text: `[r/${sub}] ${p.title}`.slice(0, 400),
          permalink: `https://reddit.com${p.permalink}`,
          timestamp: (p.created_utc || 0) * 1000,
          score,
        });
      }
    }
  } catch (e) {
    console.error('[FreeSignals] Reddit:', e.response?.status || e.message);
  }

  return dedupeByText(signals);
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

async function fetchAllFreeSignals() {
  const [a, b] = await Promise.all([fetchGoogleNewsRss(), fetchRedditPakistan()]);
  return dedupeByText([...a, ...b]).sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0));
}

module.exports = { fetchAllFreeSignals };

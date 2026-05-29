const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const RSS_FEEDS = [
  { name: 'dawn', url: process.env.DAWN_RSS_URL || 'https://www.dawn.com/feeds/home', language: 'en' },
  { name: 'ary', url: process.env.ARY_RSS_URL || 'https://arynews.tv/feed/', language: 'en' },
  { name: 'geo', url: process.env.GEO_RSS_URL || 'https://www.geo.tv/rss/1/', language: 'en' },
  { name: 'bbc_ur', url: 'https://feeds.bbci.co.uk/urdu/rss.xml', language: 'ur' },
];

const CRISIS_KEYWORDS = {
  earthquake: { words: ['earthquake', 'زلزلہ', 'tremor', 'seismic', 'richter'], score: 4 },
  flood: { words: ['flood', 'flooding', 'pani', 'baarish', 'سیلاب', 'submerged', 'waterlog'], score: 3 },
  blockage: { words: ['blocked', 'jam', 'traffic', 'band', 'congestion', 'رکاوٹ', 'بند'], score: 2 },
  accident: { words: ['accident', 'crash', 'collision', 'hadsa', 'حادثہ', 'injured'], score: 3 },
  heatwave: { words: ['heatwave', 'heat stroke', 'garmi', 'گرمی'], score: 2 },
  power: { words: ['power cut', 'load shedding', 'bijli', 'بجلی', 'blackout'], score: 2 },
  shortage: { words: ['shortage', 'atta', 'supply', 'قلت'], score: 2 },
};

async function fetchAllRSSSignals() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const allSignals = [];
  const since = Date.now() - 24 * 60 * 60 * 1000;

  const fetches = await Promise.allSettled(
    RSS_FEEDS.map((feed) =>
      axios.get(feed.url, { timeout: 8000, headers: { 'User-Agent': 'BazarCIRO/1.0' } })
    )
  );

  fetches.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const feed = RSS_FEEDS[i];
    try {
      const parsed = parser.parse(result.value.data);
      const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
      const itemArray = Array.isArray(items) ? items : [items];

      itemArray.forEach((item) => {
        const pubDate = new Date(item.pubDate || item.published || item.updated || 0).getTime();
        if (pubDate && pubDate < since) return;

        const text = `${item.title || ''} ${item.description || item.summary || ''}`
          .replace(/<[^>]+>/g, ' ')
          .toLowerCase();

        let totalScore = 0;
        const matchedTypes = [];
        Object.entries(CRISIS_KEYWORDS).forEach(([type, { words, score }]) => {
          if (words.some((w) => text.includes(w))) {
            totalScore += score;
            matchedTypes.push(type);
          }
        });

        if (totalScore >= 2) {
          allSignals.push({
            source: 'rss',
            feedName: feed.name,
            text: `${item.title}. ${String(item.description || '').replace(/<[^>]+>/g, '').slice(0, 200)}`,
            url: item.link || item.id,
            crisisTypes: matchedTypes,
            score: totalScore,
            timestamp: pubDate || Date.now(),
            language: feed.language,
          });
        }
      });
    } catch (e) {
      console.warn(`[RSS] ${feed.name}:`, e.message);
    }
  });

  return allSignals.sort((a, b) => b.score - a.score);
}

module.exports = { fetchAllRSSSignals, RSS_FEEDS };

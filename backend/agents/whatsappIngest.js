/**
 * WhatsApp signal ingestion — webhook + optional simulated crisis posts from .env
 */

const { db } = require('../lib/firebase-admin');
const { normalizeAreaKey, AREA_COORDINATES } = require('../lib/constants');

const CRISIS_RE =
  /\b(flood|pani|band|blocked|accident|emergency|سیلاب|پانی|بند|حادثہ|phans|phansi)\b/i;

function scoreWhatsAppText(text) {
  const t = (text || '').toLowerCase();
  let score = 2;
  if (CRISIS_RE.test(t)) score += 4;
  if (t.includes('g-10') || t.includes('g10') || t.includes('george town')) score += 3;
  if (t.length > 40) score += 1;
  return score;
}

function inferAreaFromText(text) {
  const t = (text || '').toLowerCase();
  const cityKeys = Object.keys(AREA_COORDINATES);

  if (t.includes('g-10') || t.includes('g10') || t.includes('g 10')) return 'islamabad';
  if (t.includes('george town') || t.includes('georgetown')) return 'islamabad';
  if (t.includes('surjani')) return 'surjani';
  if (t.includes('orangi')) return 'orangi';
  if (t.includes('faisalabad')) return 'faisalabad';
  if (t.includes('lahore')) return 'lahore_gulberg';
  if (t.includes('peshawar')) return 'peshawar';
  if (t.includes('karachi')) return 'surjani';

  for (const key of cityKeys) {
    const spaced = key.replace(/_/g, ' ');
    if (t.includes(spaced) || t.includes(key)) return key;
  }
  return null;
}

/** Simulated WhatsApp crisis posts (hackathon demo) — WHATSAPP_SIMULATED_SIGNALS JSON in .env */
function fetchSimulatedWhatsAppSignals() {
  const signals = [];
  const raw = process.env.WHATSAPP_SIMULATED_SIGNALS;
  if (!raw) return signals;

  try {
    const list = JSON.parse(raw);
    const arr = Array.isArray(list) ? list : [list];
    for (const item of arr) {
      const text = item.text || item.body || '';
      if (!text) continue;
      const area = item.area ? normalizeAreaKey(item.area) : inferAreaFromText(text);
      signals.push({
        source: 'whatsapp',
        text,
        area,
        timestamp: item.timestamp || Date.now(),
        score: scoreWhatsAppText(text),
        from: item.from || 'simulated',
      });
    }
  } catch (e) {
    console.warn('[WhatsApp Ingest] Invalid WHATSAPP_SIMULATED_SIGNALS JSON');
  }
  return signals;
}

/** Store inbound webhook message as signal + optional queue */
async function ingestWhatsAppWebhook(body) {
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const msg = change?.value?.messages?.[0];
  if (!msg?.text?.body) return null;

  const text = msg.text.body;
  const area = inferAreaFromText(text);
  const signal = {
    source: 'whatsapp',
    text,
    area,
    timestamp: parseInt(msg.timestamp, 10) * 1000 || Date.now(),
    score: scoreWhatsAppText(text),
    from: msg.from,
    messageId: msg.id,
  };

  if (db) {
    await db.ref('whatsapp_inbox').push({ ...signal, receivedAt: Date.now() });
    const latestSnap = await db.ref('signals/latest').once('value');
    const latest = latestSnap.val() || { signals: [] };
    const signals = Array.isArray(latest.signals) ? latest.signals : [];
    signals.unshift(signal);
    await db.ref('signals/latest').update({
      signals: signals.slice(0, 55),
      updatedAt: Date.now(),
    });
  }

  return signal;
}

async function fetchWhatsAppInboxSignals(maxAgeMs = 3600000) {
  const signals = [...fetchSimulatedWhatsAppSignals()];
  if (!db) return signals;

  try {
    const snap = await db.ref('whatsapp_inbox').limitToLast(20).once('value');
    const data = snap.val() || {};
    const cutoff = Date.now() - maxAgeMs;
    Object.values(data).forEach((row) => {
      if ((row.timestamp || row.receivedAt || 0) >= cutoff) {
        signals.push({
          source: 'whatsapp',
          text: row.text,
          area: row.area,
          timestamp: row.timestamp || row.receivedAt,
          score: row.score || scoreWhatsAppText(row.text),
          from: row.from,
        });
      }
    });
  } catch (e) {
    console.error('[WhatsApp Ingest] inbox:', e.message);
  }

  return signals;
}

module.exports = {
  fetchWhatsAppInboxSignals,
  fetchSimulatedWhatsAppSignals,
  ingestWhatsAppWebhook,
  inferAreaFromText,
  scoreWhatsAppText,
};

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cron = require('node-cron');
const express = require('express');
const { aggregateSignals } = require('./agents/signalAggregator');
const { detectBreak } = require('./agents/supplyBreakDetector');
const { detectRumours } = require('./agents/rumourDetector');
const { routeSupply } = require('./agents/supplyRouter');
const { assessPrice } = require('./agents/priceEngine');
const { publishTruth } = require('./agents/truthPublisher');
const { db } = require('./lib/firebase-admin');
const { normalizeAreaKey } = require('./lib/constants');

const processedSocial = new Set();

async function runSupplyCycle() {
  const signals = await aggregateSignals();
  const breakResult = await detectBreak(signals);

  if (breakResult.break && db) {
    await routeSupply(breakResult);
  }
}

async function runRumourCycle() {
  const signals = await aggregateSignals();
  const socialSources = new Set(['twitter', 'reddit', 'google_news', 'whatsapp']);
  const socialSignals = signals.filter((s) => socialSources.has(s.source));

  if (!db) return;

  // Retrieve existing claims in the last 100 entries of truth_feed to avoid duplicates
  const existingClaimsSnap = await db.ref('truth_feed').limitToLast(100).once('value');
  const existingClaims = existingClaimsSnap.val() || {};
  const existingTexts = new Set(
    Object.values(existingClaims).map(c => (c.text || '').toLowerCase().trim())
  );

  for (const signal of socialSignals) {
    const textNorm = (signal.text || '').toLowerCase().trim();
    if (existingTexts.has(textNorm)) continue;

    const key = signal.tweetId || signal.permalink || signal.link || signal.text?.slice(0, 80);
    if (key && processedSocial.has(key)) continue;

    const result = await detectRumours(signal.text, signals);
    if (result.verdict !== 'unverified' && result.confidence > 0.6) {
      await publishTruth(result, signal);
      if (key) {
        processedSocial.add(key);
        if (processedSocial.size > 500) {
          const first = processedSocial.values().next().value;
          processedSocial.delete(first);
        }
      }
    }
  }
}

cron.schedule('*/90 * * * * *', () => {
  runSupplyCycle().catch((err) => console.error('[Orchestrator] Supply cycle:', err.message));
});

cron.schedule('0 */2 * * * *', () => {
  runRumourCycle().catch((err) => console.error('[Orchestrator] Rumour cycle:', err.message));
});

if (db) {
  db.ref('price_submissions').on('child_added', async (snapshot) => {
    const submission = snapshot.val();
    if (!submission) return;
    try {
      await assessPrice({ ...submission, submissionKey: snapshot.key });
      await snapshot.ref.remove();
    } catch (err) {
      console.error('[Orchestrator] Price assessment:', err.message);
    }
  });
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), firebase: Boolean(db) });
});

app.post('/api/trigger', async (req, res) => {
  try {
    await runSupplyCycle();
    await runRumourCycle();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/claim', async (req, res) => {
  try {
    const { text, area } = req.body;
    if (!text || !area) return res.status(400).json({ error: 'text and area required' });
    const signals = await aggregateSignals();
    const result = await detectRumours(text, signals);
    if (result.verdict !== 'unverified') {
      await publishTruth(result, {
        text,
        area: normalizeAreaKey(area),
        source: 'user_report',
      });
    }
    res.json({ success: true, verdict: result.verdict, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function removeStaleSimulationRoutes() {
  if (!db) return;
  for (const id of ['m9_main', 'm2_main', 'N5_main']) {
    await db.ref(`supply_status/${id}`).remove();
  }
}

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`[Bazar Backend] Running on port ${port}`);
  await removeStaleSimulationRoutes().catch(() => {});
  runSupplyCycle().catch(() => {});
});

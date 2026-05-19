const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cron = require('node-cron');
const express = require('express');
const { aggregateSignals } = require('./agents/signalAggregator');
const { assessPrice } = require('./agents/priceEngine');
const { detectRumours } = require('./agents/rumourDetector');
const { publishTruth } = require('./agents/truthPublisher');
const { processAllActiveAreas } = require('./lib/areaAgent');
const { runCiroForArea } = require('./lib/ciroPipeline');
const { ingestWhatsAppWebhook } = require('./agents/whatsappIngest');
const { db } = require('./lib/firebase-admin');
const { normalizeAreaKey } = require('./lib/constants');

let cycleRunning = false;

/** One cycle: fetch live signals once, then run per-area agents (routes, rumours, alerts). */
async function runAgentCycle() {
  if (cycleRunning) {
    console.log('[Orchestrator] Previous cycle still running — skip.');
    return null;
  }
  cycleRunning = true;
  try {
    const { signals, globalRouteStatus } = await aggregateSignals();
    const results = await processAllActiveAreas(signals, globalRouteStatus);
    return { signals, results };
  } finally {
    cycleRunning = false;
  }
}

// Every 2 minutes — avoids ORS/Groq rate limits from 90s double-runs
cron.schedule('0 */2 * * * *', () => {
  runAgentCycle().catch((err) => console.error('[Orchestrator] Agent cycle:', err.message));
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

/** Meta WhatsApp webhook — verify + ingest crisis messages */
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verify = process.env.WHATSAPP_VERIFY_TOKEN || 'bazar_ciro';
  if (mode === 'subscribe' && token === verify) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    const signal = await ingestWhatsAppWebhook(req.body);
    if (signal) {
      runAgentCycle().catch(() => {});
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(200);
  }
});

/** CIRO status for one area */
app.get('/api/ciro/:areaKey', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Firebase offline' });
    const areaKey = normalizeAreaKey(req.params.areaKey);
    const [situation, actions, simulation, mapRoutes] = await Promise.all([
      db.ref(`crisis_situations/${areaKey}`).once('value'),
      db.ref(`crisis_actions/${areaKey}`).once('value'),
      db.ref(`crisis_simulation/${areaKey}`).once('value'),
      db.ref(`map_routes/${areaKey}`).once('value'),
    ]);
    res.json({
      situation: situation.val(),
      actions: actions.val(),
      simulation: simulation.val(),
      mapRoutes: mapRoutes.val(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trigger', async (req, res) => {
  try {
    const result = await runAgentCycle();
    res.json({ ok: true, signalCount: result?.signals?.length ?? 0, areas: result?.results ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/claim', async (req, res) => {
  try {
    const { text, area } = req.body;
    if (!text || !area) return res.status(400).json({ error: 'text and area required' });
    const { signals } = await aggregateSignals();
    const areaKey = normalizeAreaKey(area);
    const result = await detectRumours(text, signals, area);
    if (result.verdict !== 'unverified') {
      await publishTruth(result, {
        text,
        area: areaKey,
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
  runAgentCycle().catch(() => {});
});

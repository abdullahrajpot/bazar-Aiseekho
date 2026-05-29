const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cron = require('node-cron');
const express = require('express');
const { aggregateSignals } = require('./agents/signalAggregator');
const { assessPrice } = require('./agents/priceEngine');
const { detectRumours } = require('./agents/rumourDetector');
const { publishTruth } = require('./agents/truthPublisher');
const { processAllActiveAreas } = require('./lib/areaAgent');
const { ingestWhatsAppWebhook } = require('./agents/whatsappIngest');
const { runFullCiroPipeline } = require('./lib/ciroExecutionPipeline');
const { detectCrisisEvent } = require('./agents/crisisDetector');
const { db } = require('./lib/firebase-admin');
const { normalizeAreaKey } = require('./lib/constants');

let cycleRunning = false;

async function runAgentCycle() {
  if (cycleRunning) {
    console.log('[Orchestrator] Previous cycle still running — skip.');
    return null;
  }
  cycleRunning = true;
  try {
    const { signals, globalRouteStatus } = await aggregateSignals();
    const results = await processAllActiveAreas(signals, globalRouteStatus);

    const crisis = await detectCrisisEvent(signals, null, null);
    if (crisis.crisisDetected && crisis.severity === 'critical' && process.env.CIRO_FULL_PIPELINE !== '0') {
      setImmediate(() => {
        runFullCiroPipeline(signals, { area: crisis.location || crisis.areaKey }).catch((e) =>
          console.error('[CIRO Auto]', e.message)
        );
      });
    }

    return { signals, results };
  } finally {
    cycleRunning = false;
  }
}

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
app.use(express.json({ limit: '12mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), firebase: Boolean(db), groq: Boolean(process.env.GROQ_API_KEY) });
});

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
    if (signal) runAgentCycle().catch(() => {});
    res.sendStatus(200);
  } catch {
    res.sendStatus(200);
  }
});

app.get('/api/ciro/:areaKey', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Firebase offline' });
    const areaKey = normalizeAreaKey(req.params.areaKey);
    const [situation, actions, simulation, mapRoutes, incidents] = await Promise.all([
      db.ref(`crisis_situations/${areaKey}`).once('value'),
      db.ref(`crisis_actions/${areaKey}`).once('value'),
      db.ref(`crisis_simulation/${areaKey}`).once('value'),
      db.ref(`map_routes/${areaKey}`).once('value'),
      db.ref(`map_incidents/${areaKey}`).once('value'),
    ]);
    res.json({
      situation: situation.val(),
      actions: actions.val(),
      simulation: simulation.val(),
      mapRoutes: mapRoutes.val(),
      incidents: incidents.val(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Full crisis event by ID */
app.get('/api/crisis-event/:crisisId', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Firebase offline' });
  const id = req.params.crisisId;
  const [event, situation, plan, simulation, outcome] = await Promise.all([
    db.ref(`crisis_events/${id}`).once('value'),
    db.ref(`crisis_situations/${id}`).once('value'),
    db.ref(`response_plans/${id}`).once('value'),
    db.ref(`simulation_state/${id}`).once('value'),
    db.ref(`outcome_metrics/${id}`).once('value'),
  ]);
  res.json({
    event: event.val(),
    situation: situation.val(),
    plan: plan.val(),
    simulation: simulation.val(),
    outcome: outcome.val(),
  });
});

app.post('/api/trigger', async (req, res) => {
  try {
    const result = await runAgentCycle();
    res.json({ ok: true, signalCount: result?.signals?.length ?? 0, areas: result?.results ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Manual crisis detection — BAZAR_CIRO_EXECUTION */
app.post('/api/crisis', async (req, res) => {
  const { text, area } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const { signals } = await aggregateSignals();
    const result = await runFullCiroPipeline(signals, { text, area, uid: req.body.uid });
    if (result.crisisDetected) {
      return res.json({
        success: true,
        crisisDetected: true,
        crisisId: result.crisisId,
        type: result.type,
        location: result.location,
        confidence: result.confidence,
      });
    }
    res.json({ success: true, crisisDetected: false, message: result.message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** User text report */
app.post('/api/report-crisis', async (req, res) => {
  const { text, area, uid } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    let incidentId = null;
    if (db) {
      incidentId = db.ref('user_crisis_reports').push().key;
      await db.ref(`user_crisis_reports/${incidentId}`).set({
        text,
        area,
        uid: uid || 'anonymous',
        timestamp: Date.now(),
      });
    }
    const { signals } = await aggregateSignals();
    const result = await runFullCiroPipeline(signals, { text, area, uid, incidentId });
    res.json({
      success: true,
      incidentId,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Incident with optional photo (base64) — vision + full CIRO */
app.post('/api/incident', async (req, res) => {
  const { text, area, uid, lat, lng, imageBase64, imageMime } = req.body;
  if (!text && !imageBase64) {
    return res.status(400).json({ error: 'text or imageBase64 required' });
  }
  try {
    let incidentId = null;
    let imageUrl = null;
    if (db) {
      incidentId = db.ref('incident_reports').push().key;
      if (imageBase64) {
        imageUrl = `data:${imageMime || 'image/jpeg'};base64,${imageBase64.slice(0, 200)}...`;
        await db.ref(`incident_reports/${incidentId}`).set({
          text: text || 'Photo incident report',
          area,
          uid: uid || 'anonymous',
          hasImage: true,
          imagePreview: imageBase64.slice(0, 5000),
          lat,
          lng,
          timestamp: Date.now(),
          status: 'analysing',
        });
      } else {
        await db.ref(`user_crisis_reports/${incidentId}`).set({
          text,
          area,
          uid,
          timestamp: Date.now(),
        });
      }
    }

    const { signals } = await aggregateSignals();
    const result = await runFullCiroPipeline(signals, {
      text: text || 'Incident photo uploaded',
      area,
      uid,
      lat,
      lng,
      imageBase64,
      imageMime,
      incidentId,
      imageUrl,
    });

    res.json({ success: true, incidentId, ...result });
  } catch (err) {
    console.error('[Incident API]', err);
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
      await publishTruth(result, { text, area: areaKey, source: 'user_report' });
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
  console.log(`[Bazar Backend] CIRO enabled on port ${port}`);
  await removeStaleSimulationRoutes().catch(() => {});
  runAgentCycle().catch(() => {});
});

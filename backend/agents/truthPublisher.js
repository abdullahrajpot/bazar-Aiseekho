const { db } = require('../lib/firebase-admin');
const { normalizeAreaKey } = require('../lib/constants');
const { sendAreaPushNotification } = require('../lib/pushNotifications');

async function publishTruth(result, signal) {
  if (!db || !result || result.verdict === 'unverified') return;

  const area = normalizeAreaKey(signal.area || 'surjani');
  const text = signal.text || '';
  const reasonUrdu = result.reasonUrdu || result.reason_urdu || '';
  const reasonEnglish = result.reasonEnglish || result.reason_english || '';
  const counterMessageUrdu =
    result.counterMessageUrdu || result.counter_message_urdu || result.counter_message || null;

  try {
    const claimId = db.ref('truth_feed').push().key;

    await db.ref(`truth_feed/${claimId}`).set({
      text,
      verdict: result.verdict,
      confidence: result.confidence,
      reasonUrdu,
      reasonEnglish,
      reason_urdu: reasonUrdu,
      reason_english: reasonEnglish,
      counterMessageUrdu,
      counter_message: counterMessageUrdu,
      area,
      source: signal.source || 'twitter',
      timestamp: Date.now(),
    });

    await db.ref('agent_log').push({
      agent: 'rumour_detector',
      action: result.verdict === 'false' ? 'false_claim_flagged' : `claim_${result.verdict}`,
      detail: `Claim: "${text.substring(0, 60)}..." → ${result.verdict}`,
      severity: result.verdict === 'false' ? 'warning' : 'info',
      rawOutput: JSON.stringify(result),
      timestamp: Date.now(),
    });

    if (result.verdict === 'false') {
      await db.ref('admin_stats/rumoursSuppressed').transaction((n) => (n || 0) + 1);
      if (result.pushNotification !== false) {
        await sendAreaPushNotification(area, 'khareedar', {
          title: 'Jhoot pakra gaya',
          body: (counterMessageUrdu || 'Ek jhoot ki tashreeh ki gayi hai').substring(0, 100),
          type: 'truth_update',
        });
      }
    }

    console.log(`[Truth Publisher] Published: ${result.verdict}`);
  } catch (error) {
    console.error('[Truth Publisher] Error:', error.message);
  }
}

module.exports = { publishTruth };

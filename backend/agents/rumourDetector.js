const { askJson, isConfigured } = require('../lib/groqClient');
const { verifyClaimAgainstSignals } = require('../lib/signalVerifier');
const { signalMatchesArea } = require('../lib/areaRoutes');
const { normalizeAreaKey } = require('../lib/constants');

/**
 * Verify a claim using ONLY area-scoped live signals. Groq is optional enrichment.
 */
async function detectRumours(claimText, allSignals, areaLabel = null) {
  if (!claimText?.trim()) {
    return {
      verdict: 'unverified',
      confidence: 0,
      reason_urdu: 'دعویٰ خالی ہے۔',
      reason_english: 'Empty claim.',
      counter_message_urdu: null,
      push_notification: false,
    };
  }

  const areaKey = areaLabel ? normalizeAreaKey(areaLabel) : null;
  const areaSignals = areaKey
    ? (allSignals || []).filter((s) => signalMatchesArea(s, areaKey, areaLabel))
    : allSignals || [];

  const evidenceResult = verifyClaimAgainstSignals(claimText, areaSignals);

  if (!isConfigured || areaSignals.length < 2) {
    return {
      verdict: evidenceResult.verdict,
      confidence: evidenceResult.confidence,
      reason_urdu: evidenceResult.reasonUrdu,
      reason_english: evidenceResult.reasonEnglish,
      counter_message_urdu: evidenceResult.counterMessageUrdu,
      push_notification: evidenceResult.push_notification,
      evidence: evidenceResult.evidence,
    };
  }

  try {
    const ai = await askJson(
      `You are Bazar truth verification for Pakistan. Use ONLY these area-specific signals — do not invent floods or roads not mentioned.

Area: ${areaLabel || areaKey || 'unknown'}
Claim: "${claimText}"

Area signals (only source of truth):
${JSON.stringify(areaSignals.slice(0, 15), null, 2)}

Return ONLY JSON:
{
  "verdict": "verified | false | unverified",
  "confidence": 0.0,
  "reason_urdu": "must cite which signal source",
  "reason_english": "must cite which signal",
  "counter_message_urdu": "null or correction",
  "push_notification": true
}`,
      500
    );

    if (ai?.verdict && ai.confidence >= 0.55) {
      return {
        ...ai,
        reason_urdu: ai.reason_urdu || ai.reasonUrdu || evidenceResult.reasonUrdu,
        reason_english: ai.reason_english || ai.reasonEnglish || evidenceResult.reasonEnglish,
        counter_message_urdu:
          ai.counter_message_urdu || ai.counterMessageUrdu || evidenceResult.counterMessageUrdu,
      };
    }
  } catch (e) {
    console.error('[RumourDetector] Groq skip:', e.message);
  }

  return {
    verdict: evidenceResult.verdict,
    confidence: evidenceResult.confidence,
    reason_urdu: evidenceResult.reasonUrdu,
    reason_english: evidenceResult.reasonEnglish,
    counter_message_urdu: evidenceResult.counterMessageUrdu,
    push_notification: evidenceResult.push_notification,
    evidence: evidenceResult.evidence,
  };
}

module.exports = { detectRumours };

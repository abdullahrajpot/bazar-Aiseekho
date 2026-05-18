const { askJson, isConfigured } = require('../lib/groqClient');

async function detectRumours(claimText, verifiedSignals) {
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

  if (!isConfigured || verifiedSignals.length === 0) {
    return {
      verdict: 'unverified',
      confidence: 0.4,
      reason_urdu: 'ابھی لائیو ڈیٹا یا AI تصدیق دستیاب نہیں۔ براہ کرم انتظار کریں۔',
      reason_english: 'Insufficient live data to verify this claim yet.',
      counter_message_urdu: null,
      push_notification: false,
    };
  }

  try {
    const result = await askJson(
        `You are Bazar's truth verification engine for Pakistan crisis information.

Do NOT assume flood unless signals mention flood. Crises may include conflict, road closure, prices, or supply.
Only use the verified signals below.

The claim (may be in Urdu, Roman Urdu, or English):
"${claimText}"

Verified real-time data we have right now:
${JSON.stringify(verifiedSignals, null, 2)}

Return ONLY valid JSON:
{
  "verdict": "verified | false | unverified",
  "confidence": 0.91,
  "reason_urdu": "2 sentence Urdu explanation",
  "reason_english": "Brief English explanation",
  "counter_message_urdu": "Correction if false, else null",
  "push_notification": true
}`,
      500
    );

    if (result) return result;
  } catch (error) {
    console.error('[RumourDetector] Groq error:', error.message);
  }

  return {
    verdict: 'unverified',
    confidence: 0.3,
    reason_urdu: 'تصدیق مکمل نہیں ہو سکی۔',
    reason_english: 'Verification could not be completed.',
    counter_message_urdu: null,
    push_notification: false,
  };
}

module.exports = { detectRumours };

const axios = require('axios');

const apiKey = process.env.GROQ_API_KEY;
const isConfigured =
  apiKey &&
  apiKey !== 'dummy' &&
  !apiKey.includes('...') &&
  apiKey.length > 20;

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

let lastFallbackLogAt = 0;
let lastRateLimitLogAt = 0;
let groqCallsThisMinute = 0;
let groqMinuteStart = Date.now();
let groqPausedUntil = 0;

function canCallGroq() {
  if (process.env.CIRO_USE_GROQ === '0') return false;
  const now = Date.now();
  if (now < groqPausedUntil) return false;
  if (now - groqMinuteStart > 60000) {
    groqMinuteStart = now;
    groqCallsThisMinute = 0;
  }
  if (groqCallsThisMinute >= 5) return false;
  groqCallsThisMinute += 1;
  return true;
}

// Autonomous Self-Healing Agent Model Simulator
function generateSelfHealingFallback(prompt) {
  const now = Date.now();
  if (now - lastFallbackLogAt > 120000) {
    lastFallbackLogAt = now;
    console.log('[Groq] Using local rule-based agent (Groq unavailable or rate-limited).');
  }
  const promptLower = prompt.toLowerCase();

  // Case 1: Price Fairness Agent
  if (promptLower.includes('price fairness agent')) {
    const itemMatch = prompt.match(/Item:\s*([^\r\n]+)/);
    const priceMatch = prompt.match(/Reported price:\s*Rs\s*([0-9.]+)/);
    const baselineMatch = prompt.match(/Baseline:\s*Rs\s*([0-9.]+)/);
    const crisisMatch = prompt.match(/Crisis max:\s*Rs\s*([0-9.]+)/);

    const item = itemMatch ? itemMatch[1].trim() : 'atta';
    const price = priceMatch ? parseFloat(priceMatch[1]) : 1000;
    const baseline = baselineMatch ? parseFloat(baselineMatch[1]) : 800;
    const crisisMax = crisisMatch ? parseFloat(crisisMatch[1]) : 950;

    let verdict = 'fair';
    let dukandar_message_urdu = 'شکریہ — آپ کی قیمت مناسب اور مقررہ حد کے اندر ہے۔';
    let consumer_warning = false;
    let push_to_consumers = false;

    const percentOver = Math.round(((price - baseline) / baseline) * 100);

    if (price > crisisMax * 1.25) {
      verdict = 'gouging';
      dukandar_message_urdu = `نوٹس: آپ کا ریٹ Rs ${price} بہت زیادہ ہے۔ فوری طور پر سرکاری نرخ نامہ Rs ${baseline} کے مطابق درست کریں۔`;
      consumer_warning = true;
      push_to_consumers = true;
    } else if (price > baseline * 1.15) {
      verdict = 'high';
      dukandar_message_urdu = `قیمت اوسط سے زیادہ ہے۔ سپلائی بحال ہونے پر ریٹ Rs ${baseline} تک لائیں۔`;
      consumer_warning = true;
    }

    return {
      fair_price: baseline,
      verdict,
      percent_over: Math.max(0, percentOver),
      dukandar_message_urdu,
      consumer_warning,
      push_to_consumers,
      reasoning: `Bazar Agent Engine: Computed ${verdict} for ${item} (Reported: Rs ${price}, Baseline: Rs ${baseline}) under current transit signals.`,
    };
  }

  // Rumour / supply-break: handled by signalVerifier + areaAgent — no keyword fallback

  // Case 2: Supply Routing Agent
  if (promptLower.includes('supply routing agent')) {
    const routeMatch = prompt.match(/"alternateRoute":\s*"([^"]+)"/);
    const alternateRoute = routeMatch ? routeMatch[1] : 'N55';

    return {
      truckSmsUrdu: `بازار الرٹ: ہائی وے پر رکاوٹ کی وجہ سے متبادل راستہ ${alternateRoute} اختیار کریں۔ احتیاط سے ڈرائیو کریں۔`,
      dukandarSmsUrdu: `معزز دکاندار: سپلائی متبادل روٹ ${alternateRoute} سے آ رہی ہے۔ مقررہ نرخوں پر ہی سیل جاری رکھیں۔`,
      publicAlertUrdu: `سپلائی روٹ میں تبدیلی: سامان متبادل ہائی وے ${alternateRoute} کے ذریعے پہنچایا جا رہا ہے۔`,
      publicAlertEnglish: `Logistics alert: Supply routed via ${alternateRoute} alternate bypass. Delivery scheduled.`,
      reroutedTrucks: 4,
      etaExtraMinutes: 30,
      alternateRoute,
      safetyScore: 88,
    };
  }

  // Generic fallback
  return {
    status: 'ok',
    message: 'Local agent processing complete',
  };
}

function isEvidenceAgentPrompt(prompt) {
  const p = prompt.toLowerCase();
  return p.includes('truth verification') || p.includes('supply break detector');
}

async function askJson(prompt, maxTokens = 600) {
  const promptLower = prompt.toLowerCase();
  const skipFallback = isEvidenceAgentPrompt(prompt);

  if (!isConfigured) {
    if (skipFallback) return null;
    return generateSelfHealingFallback(prompt);
  }

  if (!canCallGroq()) {
    if (skipFallback) return null;
    return generateSelfHealingFallback(prompt);
  }

  try {
    const response = await axios.post(
      GROQ_URL,
      {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const text = (response.data?.choices?.[0]?.message?.content || '').trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      if (skipFallback) return null;
      return generateSelfHealingFallback(prompt);
    }
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    const isRateLimit = error.response?.status === 429 || JSON.stringify(error.response?.data || {}).includes('rate_limit');
    const now = Date.now();
    if (isRateLimit) {
      groqPausedUntil = now + 5 * 60 * 1000;
      if (now - lastRateLimitLogAt > 300000) {
        lastRateLimitLogAt = now;
        console.warn('[Groq] Rate limit — rule-based agents for 5 min (set CIRO_USE_GROQ=0 to silence).');
      }
    } else if (now - lastRateLimitLogAt > 60000) {
      const detail = error.response?.data?.error?.message || error.message;
      if (detail && !String(detail).includes('rate_limit')) {
        console.error('[Groq] API error:', detail);
      }
    }
    
    if (skipFallback) return null;
    return generateSelfHealingFallback(prompt);
  }
}

const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview';

async function askVisionJson(prompt, imageBase64, mimeType = 'image/jpeg', maxTokens = 700) {
  if (!isConfigured || !imageBase64) return null;

  try {
    const response = await axios.post(
      GROQ_URL,
      {
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.15,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const text = (response.data?.choices?.[0]?.message?.content || '').trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    console.error('[Groq Vision] Error:', error.response?.data?.error?.message || error.message);
    return null;
  }
}

module.exports = { askJson, askVisionJson, isConfigured, MODEL, VISION_MODEL };

const { askVisionJson, askJson, isConfigured } = require('../lib/groqClient');
const { AREA_COORDINATES, normalizeAreaKey } = require('../lib/constants');

const ACCIDENT_VISUAL = /\b(crash|collision|overturn|damage|wreck|حادثہ|accident|fire|smoke|flood water)\b/i;

async function analyzeIncidentImage(imageBase64, mimeType, context = {}) {
  const { area, text, lat, lng } = context;
  const prompt = `You are CIRO vision agent for Pakistan emergency response.
Analyze this incident photo. Area hint: ${area || 'unknown'}.
User note: ${text || 'none'}

Return ONLY JSON:
{
  "crisisDetected": true,
  "type": "flood | heatwave | road_blockage | accident | infrastructure | none",
  "severity": "low | medium | high | critical",
  "confidence": 0.0,
  "description_english": "what you see",
  "description_urdu": "Urdu summary",
  "injuriesVisible": false,
  "vehiclesInvolved": 0,
  "recommendedAgencies": ["Rescue 1122", "Police"],
  "immediateActions": ["action 1", "action 2"]
}`;

  let result = await askVisionJson(prompt, imageBase64, mimeType);

  if (!result && isConfigured) {
    result = await askJson(
      `CIRO: user uploaded incident image for ${area}. Note: ${text}. Infer likely crisis type from context. Return same JSON schema with conservative confidence.`,
      500
    );
  }

  if (!result) {
    const guessType = ACCIDENT_VISUAL.test(text || '') ? 'accident' : 'road_blockage';
    result = {
      crisisDetected: true,
      type: guessType,
      severity: 'high',
      confidence: 0.65,
      description_english: text || 'User-reported incident — vision unavailable, using text.',
      description_urdu: 'صارف کی رپورٹ — تصویر کا تجزیہ دستیاب نہیں۔',
      injuriesVisible: false,
      vehiclesInvolved: 1,
      recommendedAgencies: ['Rescue 1122', 'Police'],
      immediateActions: ['Dispatch Rescue 1122', 'Reroute traffic'],
    };
  }

  const areaKey = normalizeAreaKey(area);
  const coord = AREA_COORDINATES[areaKey];
  result.locationCoords = lat && lng ? { lat: Number(lat), lng: Number(lng) } : coord
    ? { lat: coord.latitude, lng: coord.longitude }
    : { lat: 24.89, lng: 67.04 };

  return result;
}

module.exports = { analyzeIncidentImage };

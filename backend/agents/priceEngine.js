const BASELINE_PRICES = require('../data/baselinePrices.json');
const { askJson, isConfigured } = require('../lib/groqClient');
const { db } = require('../lib/firebase-admin');
const { normalizeAreaKey } = require('../lib/constants');
const { sendDukandarAlert } = require('./dispatchAgent');

async function getSupplyState(area) {
  if (!db) return { status: 'unknown' };

  const supplySnap = await db.ref('supply_status').once('value');
  const routes = supplySnap.val() || {};
  const blocked = Object.values(routes).some(
    (r) => r?.status === 'blocked' || r?.status === 'partial'
  );
  return blocked ? { status: 'disrupted', extra_minutes: 30 } : { status: 'normal' };
}

function assessFromBaseline(submission, baseline, supplyState) {
  const { price } = submission;
  const crisisMax = baseline.crisis_max || baseline.crisisMax || baseline.normal * 1.2;
  const normalMax = baseline.normal * 1.15;
  const gougeThreshold = Math.max(baseline.normal * 1.5, crisisMax);

  let verdict = 'fair';
  if (price > gougeThreshold || (supplyState.status !== 'disrupted' && price > crisisMax)) {
    verdict = 'gouging';
  } else if (price > normalMax) {
    verdict = 'high';
  }

  const percentOver = Math.max(0, Math.round(((price - baseline.normal) / baseline.normal) * 100));

  return {
    fairPrice: baseline.normal,
    fair_price: baseline.normal,
    verdict,
    percentOver,
    percent_over: percentOver,
    dukandarMessageUrdu:
      verdict === 'gouging'
        ? 'آپ کا دام مقررہ حد سے زیادہ ہے۔ سپلائی آ رہی ہے — مناسب قیمت رکھیں۔'
        : verdict === 'high'
          ? 'قیمت تھوڑی زیادہ ہے۔ سپلائی بحال ہونے پر کم کریں۔'
          : 'شکریہ — آپ کی قیمت مناسب ہے۔',
    dukandar_message_urdu:
      verdict === 'gouging'
        ? 'آپ کا دام مقررہ حد سے زیادہ ہے۔'
        : 'شکریہ — fair daam',
    consumer_warning: verdict !== 'fair',
    push_to_consumers: verdict === 'gouging',
    reasoning: `Baseline Rs ${baseline.normal}; reported Rs ${price}.`,
  };
}

async function assessPrice(submission) {
  const itemId = submission.itemId || submission.item;
  const area = submission.area;
  const areaKey = normalizeAreaKey(area);
  const shopId = submission.shopId || submission.shop_id || 'unknown';
  const shopName = submission.shopName || submission.shop_name || 'Unknown';
  const submissionKey = submission.submissionKey || submission.reportId || String(Date.now());
  const baseline = BASELINE_PRICES[itemId] || { normal: 1000, crisis_max: 1200 };
  const supplyState = await getSupplyState(area);

  let result;
  try {
    if (isConfigured) {
      result = await askJson(
        `You are Bazar's price fairness agent for Karachi.

Item: ${itemId}
Area: ${area}
Shop: ${shopName}
Reported price: Rs ${submission.price}
Baseline: Rs ${baseline.normal}
Crisis max: Rs ${baseline.crisis_max}
Supply: ${JSON.stringify(supplyState)}

Return ONLY valid JSON:
{
  "fairPrice": 980,
  "verdict": "fair | high | gouging",
  "percentOver": 0,
  "dukandarMessageUrdu": "short Urdu message",
  "consumer_warning": true,
  "push_to_consumers": true,
  "reasoning": "one sentence"
}`,
        400
      );
      if (result) {
        result.percent_over = result.percentOver ?? result.percent_over ?? 0;
        result.fair_price = result.fairPrice ?? result.fair_price;
        result.dukandar_message_urdu = result.dukandarMessageUrdu ?? result.dukandar_message_urdu;
      }
    }
  } catch (error) {
    console.error('[PriceEngine] Groq error:', error.message);
  }

  if (!result) {
    result = assessFromBaseline(submission, baseline, supplyState);
  }

  if (!db) return result;

  // Write 1: verdict into prices node
  await db.ref(`prices/${areaKey}/${itemId}/reports/${submissionKey}`).set({
    price: submission.price,
    shopId,
    shopName,
    shop_id: shopId,
    shop_name: shopName,
    submittedBy: submission.submittedBy || (submission.reporter ? 'khareedar' : 'dukandar'),
    submitterUid: submission.submitterUid || submission.reporter || null,
    verdict: result.verdict,
    fairPrice: result.fairPrice || result.fair_price,
    fair_price: result.fairPrice || result.fair_price,
    percentOver: result.percentOver ?? result.percent_over ?? 0,
    percent_over: result.percentOver ?? result.percent_over ?? 0,
    timestamp: submission.timestamp || Date.now(),
  });

  // Write 2: fair price on item node
  await db.ref(`prices/${areaKey}/${itemId}/fairPrice`).set(result.fairPrice || result.fair_price);

  // Write 3: agent log
  await db.ref('agent_log').push({
    agent: 'price_engine',
    action: result.verdict === 'gouging' ? 'gouging_flagged' : `price_verified_${result.verdict}`,
    detail: `${shopName} — ${itemId}: Rs ${submission.price} → ${result.verdict} (fair: Rs ${result.fairPrice || result.fair_price})`,
    severity: result.verdict === 'gouging' ? 'warning' : 'info',
    rawOutput: JSON.stringify(result),
    timestamp: Date.now(),
  });

  // Write 4: gouging shop updates
  if (result.verdict === 'gouging') {
    await db.ref(`shops/${shopId}/reputation`).set('flagged');
    await db.ref(`shops/${shopId}/warningCount`).transaction((n) => (n || 0) + 1);
    await db.ref(`shops/${shopId}/warning_count`).transaction((n) => (n || 0) + 1);
    await db.ref('admin_stats/gougingShopsFlagged').transaction((n) => (n || 0) + 1);

    const phone = submission.shopPhone || submission.owner_phone;
    if (phone) {
      await sendDukandarAlert(phone, result);
    }
  }

  return result;
}

module.exports = { assessPrice, assessPrices: assessPrice };

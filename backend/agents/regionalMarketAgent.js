/**
 * Auto-manage prices & supply chips for crisis-affected region (no dukandar input).
 */
const { db } = require('../lib/firebase-admin');
const { normalizeAreaKey } = require('../lib/constants');
const baselinePrices = require('../data/baselinePrices.json');

async function updateRegionalMarket(areaLabel, crisis, situation) {
  if (!db || !areaLabel) return;
  const areaKey = normalizeAreaKey(areaLabel);
  const severity = crisis?.severity || 'medium';
  const multiplier =
    severity === 'critical' ? 1.22 : severity === 'high' ? 1.12 : severity === 'medium' ? 1.06 : 1;

  const supply = [];
  for (const [itemId, base] of Object.entries(baselinePrices)) {
    const fair = Math.round(base.normal * multiplier);
    const crisisMax = Math.round(base.crisis_max * multiplier);
    const reported = Math.round(fair * (severity === 'critical' ? 1.08 : 1.02));
    const verdict =
      reported > crisisMax * 1.15 ? 'gouging' : reported > fair * 1.12 ? 'high' : 'fair';

    await db.ref(`prices/${areaKey}/${itemId}`).update({
      fairPrice: fair,
      agentManaged: true,
      updatedAt: Date.now(),
    });

    await db.ref(`prices/${areaKey}/${itemId}/reports/agent_${itemId}`).set({
      price: reported,
      shopId: 'agent_regional',
      shopName: 'CIRO Regional Scan',
      verdict,
      fairPrice: fair,
      percentOver: Math.round(((reported - fair) / fair) * 100),
      timestamp: Date.now(),
      submittedBy: 'regional_market_agent',
      crisisId: crisis?.crisisId || null,
    });

    supply.push({
      itemId,
      status: verdict === 'gouging' ? 'critical' : verdict === 'high' ? 'warning' : 'ok',
      label: itemId.replace(/_/g, ' '),
    });
  }

  await db.ref(`regional_market/${areaKey}`).set({
    areaLabel,
    supply,
    crisisType: crisis?.type,
    multiplier,
    updatedAt: Date.now(),
    source: 'regional_market_agent',
  });

  await db.ref('agent_log').push({
    agent: 'regional_market_agent',
    action: 'prices_updated',
    detail: `Auto prices for ${areaLabel} (${severity}) — crisis ${crisis?.type || 'monitoring'}`,
    severity: 'info',
    area: areaKey,
    timestamp: Date.now(),
  });
}

module.exports = { updateRegionalMarket };

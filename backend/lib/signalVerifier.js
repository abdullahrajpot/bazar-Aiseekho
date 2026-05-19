/**
 * Evidence-based verification — verdicts must cite live signals, never invent crises from claim text alone.
 */

const CRISIS_RE =
  /\b(flood|blocked|blockage|closure|curfew|strike|shortage|attack|conflict|waterlog|gridlock|band|بند|سیلاب|بندش|ہڑتال|نگران)\b/i;
const CALM_RE =
  /\b(clear|normal|open|restored|available|stable|بحال|کھلا|دستیاب|بہتر)\b/i;
const PRICE_RE = /\b(price|mehenga|inflation|daam|مہنگا|قیمت|rate)\b/i;
const SUPPLY_RE = /\b(atta|wheat|flour|آٹا|ghee|lpg|gas|sugar|chini|doodh|milk|mandi)\b/i;

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function overlapScore(claim, signalText) {
  const a = new Set(tokenize(claim));
  const b = tokenize(signalText);
  if (!a.size || !b.length) return 0;
  let hit = 0;
  for (const w of b) if (a.has(w)) hit++;
  return hit / Math.max(a.size, 1);
}

function pickEvidence(signals, max = 2) {
  return signals
    .slice(0, max)
    .map((s) => `[${s.source}] ${(s.text || '').slice(0, 120)}`)
    .join(' · ');
}

/**
 * @param {string} claimText
 * @param {object[]} areaSignals — already filtered to one area
 */
function verifyClaimAgainstSignals(claimText, areaSignals) {
  const claim = (claimText || '').trim();
  if (!claim) {
    return {
      verdict: 'unverified',
      confidence: 0,
      reasonUrdu: 'دعویٰ خالی ہے۔',
      reasonEnglish: 'Empty claim.',
      counterMessageUrdu: null,
      push_notification: false,
      evidence: null,
    };
  }

  const pool = (areaSignals || []).filter((s) => s.text && s.source !== 'ors_maps');
  if (pool.length === 0) {
    return {
      verdict: 'unverified',
      confidence: 0.4,
      reasonUrdu: 'اس علاقے کے لیے ابھی کوئی لائیو خبر یا سگنل نہیں ملا۔',
      reasonEnglish: 'No live feeds matched this area yet — wait for next agent scan.',
      counterMessageUrdu: null,
      push_notification: false,
      evidence: null,
    };
  }

  const ranked = [...pool].sort((a, b) => {
    const sa = (a.score || 0) + overlapScore(claim, a.text) * 5;
    const sb = (b.score || 0) + overlapScore(claim, b.text) * 5;
    return sb - sa;
  });

  const crisisSignals = ranked.filter((s) => CRISIS_RE.test(s.text));
  const calmSignals = ranked.filter((s) => CALM_RE.test(s.text));
  const claimCrisis = CRISIS_RE.test(claim);
  const claimPrice = PRICE_RE.test(claim);
  const claimSupply = SUPPLY_RE.test(claim);

  const weather = ranked.find((s) => s.source === 'weather');
  const heavyRain = weather && (weather.rainMmPerHour || 0) >= 15;

  // Claim says crisis but feeds for THIS area say calm
  if (claimCrisis && calmSignals.length > 0 && crisisSignals.length === 0 && !heavyRain) {
    return {
      verdict: 'false',
      confidence: 0.82,
      reasonUrdu: `لائیو ذرائع (${calmSignals[0].source}) اس علاقے میں بندش یا سیلاب کی تصدیق نہیں کرتے۔`,
      reasonEnglish: `Live sources for this area do not support a crisis claim. Evidence: ${pickEvidence(calmSignals)}`,
      counterMessageUrdu: 'یہ خبر غلط ہو سکتی ہے — ہمارے اسکین شدہ ذرائع میں کوئی بندش نہیں ملی۔',
      push_notification: true,
      evidence: pickEvidence(calmSignals),
    };
  }

  // Claim says crisis and area feeds agree
  if (claimCrisis && (crisisSignals.length > 0 || heavyRain)) {
    const ev = crisisSignals.length ? crisisSignals : [weather];
    return {
      verdict: 'verified',
      confidence: 0.85,
      reasonUrdu: `اس علاقے کے لائیو ذرائع میں بحران کی نشاندہی: ${pickEvidence(ev, 1)}`,
      reasonEnglish: `Crisis indicators found in area-scoped feeds. ${pickEvidence(ev)}`,
      counterMessageUrdu: null,
      push_notification: false,
      evidence: pickEvidence(ev),
    };
  }

  // Price / supply rumours
  if (claimPrice || claimSupply) {
    const priceSignals = ranked.filter((s) => PRICE_RE.test(s.text) || SUPPLY_RE.test(s.text));
    if (priceSignals.length === 0) {
      return {
        verdict: 'unverified',
        confidence: 0.5,
        reasonUrdu: 'قیمت یا سپلائی سے متعلق اس علاقے کی کوئی تازہ خبر نہیں ملی۔',
        reasonEnglish: 'No price/supply headlines matched this area in the latest scan.',
        counterMessageUrdu: null,
        push_notification: false,
        evidence: null,
      };
    }
    const supportsSpike = priceSignals.some((s) =>
      /\b(spike|surge|high|shortage|مہنگا|کم|ngah)\b/i.test(s.text)
    );
    if (claimPrice && /\b(double|triple|بہت|record)\b/i.test(claim) && !supportsSpike) {
      return {
        verdict: 'false',
        confidence: 0.78,
        reasonUrdu: 'خبریں اس علاقے میں اتنی تیز قیمتوں کی تصدیق نہیں کرتیں۔',
        reasonEnglish: `Area news does not support extreme price claims. ${pickEvidence(priceSignals)}`,
        counterMessageUrdu: 'قیمتیں بڑھی ہوئی ہیں مگر دگنی ہونے کی تصدیق نہیں۔',
        push_notification: true,
        evidence: pickEvidence(priceSignals),
      };
    }
    return {
      verdict: 'verified',
      confidence: 0.72,
      reasonUrdu: `مارکیٹ/سپلائی خبریں اس علاقے سے ملی: ${pickEvidence(priceSignals, 1)}`,
      reasonEnglish: `Market-related feeds matched this area. ${pickEvidence(priceSignals)}`,
      counterMessageUrdu: null,
      push_notification: false,
      evidence: pickEvidence(priceSignals),
    };
  }

  // High-score headline with no strong claim — treat as monitoring, not auto-false
  const top = ranked[0];
  if ((top.score || 0) >= 5 && overlapScore(claim, top.text) > 0.15) {
    return {
      verdict: CRISIS_RE.test(top.text) ? 'verified' : 'unverified',
      confidence: 0.7,
      reasonUrdu: `قریبی خبر: ${top.text.slice(0, 100)}`,
      reasonEnglish: `Related feed: ${top.text.slice(0, 120)}`,
      counterMessageUrdu: null,
      push_notification: false,
      evidence: pickEvidence([top]),
    };
  }

  return {
    verdict: 'unverified',
    confidence: 0.45,
    reasonUrdu: 'اس دعویٰ کی تصدیق کے لیے مزید اس علاقے کی خبریں درکار ہیں۔',
    reasonEnglish: 'Not enough area-specific evidence to verify this claim.',
    counterMessageUrdu: null,
    push_notification: false,
    evidence: pickEvidence(ranked.slice(0, 2)),
  };
}

module.exports = { verifyClaimAgainstSignals, CRISIS_RE };

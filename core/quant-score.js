/**
 * Master Quant Score (360° Evaluation) — deterministic 100-point composite.
 *
 * Weights (institutional-analyst final report):
 *   Technical Momentum     20%  (0–20)
 *   Fundamental & Value    20%  (0–20)
 *   Catalyst & Sentiment   20%  (0–20)
 *   Bandarmologi Flow      40%  (0–40)
 *
 * Spec: core/quant-score-spec.json
 */

const WEIGHTS = {
  technical: 20,
  fundamental: 20,
  sentiment: 20,
  bandarmologi: 40,
};

const RATING_BANDS = [
  { rating: 'STRONG BUY', minScore: 80 },
  { rating: 'BUY', minScore: 65 },
  { rating: 'HOLD', minScore: 45 },
  { rating: 'SELL', minScore: 30 },
  { rating: 'STRONG SELL', minScore: 0 },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function resolveRating(total) {
  for (const band of RATING_BANDS) {
    if (total >= band.minScore) return band.rating;
  }
  return 'STRONG SELL';
}

/** @deprecated Use bandarmologi — kept for backward compatibility */
function normalizeInput(input = {}) {
  const normalized = { ...input };
  if (!normalized.bandarmologi && normalized.bandarmology) {
    normalized.bandarmologi = normalized.bandarmology;
  }
  return normalized;
}

function scoreTechnical(signals = {}) {
  if (signals.score != null && !Number.isNaN(Number(signals.score))) {
    return round1(clamp(Number(signals.score), 0, WEIGHTS.technical));
  }

  let pts = 10;

  const rsi = Number(signals.rsi14);
  if (!Number.isNaN(rsi)) {
    if (rsi >= 40 && rsi <= 65) pts += 4;
    else if (rsi > 70) pts -= 3;
    else if (rsi < 30) pts += 2;
  }

  const vwap = String(signals.vwapStatus || signals.vwap_status || '').toLowerCase();
  if (vwap === 'above' || vwap === 'bullish') pts += 3;
  else if (vwap === 'below' || vwap === 'bearish') pts -= 3;

  const ma = String(signals.maAlignment || signals.ma_alignment || '').toLowerCase();
  if (ma.includes('bull') || ma.includes('golden')) pts += 3;
  else if (ma.includes('bear') || ma.includes('death')) pts -= 4;

  const smc = String(signals.smcBias || signals.smc_bias || '').toLowerCase();
  if (smc.includes('bull') || smc === 'bos_up') pts += 2;
  else if (smc.includes('bear') || smc === 'bos_down') pts -= 2;

  return round1(clamp(pts, 0, WEIGHTS.technical));
}

function scoreFundamental(signals = {}) {
  if (signals.score != null && !Number.isNaN(Number(signals.score))) {
    return round1(clamp(Number(signals.score), 0, WEIGHTS.fundamental));
  }

  let pts = 10;

  const pe = parseFloat(String(signals.peRatio || signals.pe_ratio || '').replace(/,/g, ''));
  if (!Number.isNaN(pe)) {
    if (pe > 0 && pe < 12) pts += 4;
    else if (pe >= 12 && pe <= 25) pts += 2;
    else if (pe > 40) pts -= 4;
  }

  const pbv = parseFloat(String(signals.pbv || signals.priceToBook || '').replace(/,/g, ''));
  if (!Number.isNaN(pbv)) {
    if (pbv > 0 && pbv < 1.5) pts += 3;
    else if (pbv > 4) pts -= 3;
  }

  const roe = parseFloat(String(signals.roe || signals.roe_ttm || '').replace(/%/g, ''));
  if (!Number.isNaN(roe)) {
    if (roe >= 15) pts += 2;
    else if (roe < 5) pts -= 2;
  }

  const mosPct = Number(signals.marginOfSafetyPct ?? signals.margin_of_safety_pct);
  if (!Number.isNaN(mosPct)) {
    if (mosPct >= 20) pts += 4;
    else if (mosPct >= 10) pts += 2;
    else if (mosPct < 0) pts -= 4;
  } else {
    const mos = signals.marginOfSafety || signals.margin_of_safety;
    if (mos === 'high' || mos === 'deep_value') pts += 3;
    else if (mos === 'value_trap') pts -= 5;
  }

  const price = Number(signals.currentPrice || signals.current_price);
  const fair = Number(signals.fairValue || signals.fair_value || signals.nilaiWajar);
  if (!Number.isNaN(price) && !Number.isNaN(fair) && fair > 0) {
    const discount = ((fair - price) / fair) * 100;
    if (discount >= 15) pts += 3;
    else if (discount < -10) pts -= 3;
  }

  return round1(clamp(pts, 0, WEIGHTS.fundamental));
}

function scoreSentiment(signals = {}) {
  if (signals.score != null && !Number.isNaN(Number(signals.score))) {
    return round1(clamp(Number(signals.score), 0, WEIGHTS.sentiment));
  }

  let pts = 10;

  if (signals.insiderBuying === true || signals.insider_buying === true) pts += 5;
  if (signals.genuineCatalyst === true || signals.genuine_catalyst === true) pts += 4;
  if (signals.retailFomo === true || signals.retail_fomo === true) pts -= 4;
  if (signals.retailPanic === true || signals.retail_panic === true) pts += 2;
  if (signals.manipulativeNoise === true || signals.manipulative_noise === true) pts -= 5;

  const tone = String(signals.sentimentBias || signals.sentiment_bias || '').toLowerCase();
  if (tone.includes('bull') || tone === 'positive') pts += 3;
  else if (tone.includes('bear') || tone === 'negative') pts -= 3;

  return round1(clamp(pts, 0, WEIGHTS.sentiment));
}

function scoreBandarmologi(signals = {}) {
  if (signals.score != null && !Number.isNaN(Number(signals.score))) {
    return round1(clamp(Number(signals.score), 0, WEIGHTS.bandarmologi));
  }

  let pts = 20;

  const flow = String(signals.netFlow || signals.net_flow || signals.bias || '').toLowerCase();
  if (flow.includes('accum') || flow === 'net_buy') pts += 12;
  else if (flow.includes('distribut') || flow === 'net_sell') pts -= 12;

  const foreign = String(signals.foreignFlow || signals.foreign_flow || '').toLowerCase();
  if (foreign.includes('buy') || foreign === 'net_foreign_buy') pts += 6;
  else if (foreign.includes('sell') || foreign === 'net_foreign_sell') pts -= 6;

  if (signals.cornering === true || signals.cornering_detected === true) pts += 4;
  if (signals.shakeout === true) pts += 3;
  if (signals.fakeout === true) pts -= 8;

  const smartMoney = Number(signals.smartMoneyScore || signals.smart_money_score);
  if (!Number.isNaN(smartMoney)) {
    pts = (smartMoney / 100) * WEIGHTS.bandarmologi;
  }

  return round1(clamp(pts, 0, WEIGHTS.bandarmologi));
}

/**
 * @param {object} input
 * @returns {object}
 */
function calculateQuantScore(input = {}) {
  const data = normalizeInput(input);

  const technical = scoreTechnical(data.technical || {});
  const fundamental = scoreFundamental(data.fundamental || {});
  const sentiment = scoreSentiment(data.sentiment || {});
  const bandarmologi = scoreBandarmologi(data.bandarmologi || {});

  const total = round1(technical + fundamental + sentiment + bandarmologi);
  const rating = resolveRating(total);

  const fundSignals = data.fundamental || {};

  return {
    ticker: data.ticker || null,
    totalQuantScore: total,
    quantScore: total,
    maxScore: 100,
    rating,
    weights: WEIGHTS,
    breakdown: {
      technicalMomentum: {
        score: technical,
        max: WEIGHTS.technical,
        weight: '20%',
        source: 'technical-analyst',
      },
      fundamentalValue: {
        score: fundamental,
        max: WEIGHTS.fundamental,
        weight: '20%',
        source: 'fundamental-analyst',
        fairValue: fundSignals.fairValue ?? fundSignals.fair_value ?? fundSignals.nilaiWajar ?? null,
        marginOfSafetyPct: fundSignals.marginOfSafetyPct ?? fundSignals.margin_of_safety_pct ?? null,
      },
      catalystSentiment: {
        score: sentiment,
        max: WEIGHTS.sentiment,
        weight: '20%',
        source: 'sentiment-analyst',
      },
      bandarmologiFlow: {
        score: bandarmologi,
        max: WEIGHTS.bandarmologi,
        weight: '40%',
        source: 'institutional-analyst',
      },
    },
    methodology: 'Master Quant Score 360°',
    spec: 'core/quant-score-spec.json',
  };
}

function printCliHelp() {
  console.log('quant-score.js — Master Quant Score (360° Evaluation)');
  console.log('\nEngines (sum = 100):');
  console.log('  Technical Momentum     20 pts  --technical');
  console.log('  Fundamental & Value    20 pts  --fundamental');
  console.log('  Catalyst & Sentiment   20 pts  --sentiment');
  console.log('  Bandarmologi Flow      40 pts  --bandarmologi  (alias: --bandarmology)');
  console.log('\nUsage:');
  console.log('  node quant-score.js --technical 15 --fundamental 14 --sentiment 11 --bandarmologi 32 --ticker BBCA');
  console.log('  node quant-score.js --input .data/temp/bbca_quant_input.json');
  console.log('\nRatings: STRONG BUY (≥80) · BUY (≥65) · HOLD (≥45) · SELL (≥30) · STRONG SELL (<30)');
}

if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printCliHelp();
    process.exit(0);
  }

  let input = {};
  const inputIdx = args.indexOf('--input');
  if (inputIdx !== -1 && args[inputIdx + 1]) {
    input = JSON.parse(fs.readFileSync(args[inputIdx + 1], 'utf8'));
  } else if (args.includes('--stdin')) {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      console.log(JSON.stringify(calculateQuantScore(input), null, 2));
    });
    return;
  } else {
    const getFlag = (name) => {
      const i = args.indexOf(name);
      return i !== -1 && args[i + 1] ? Number(args[i + 1]) : null;
    };
    const t = getFlag('--technical');
    const f = getFlag('--fundamental');
    const s = getFlag('--sentiment');
    const b = getFlag('--bandarmologi') ?? getFlag('--bandarmology');
    const tickerIdx = args.indexOf('--ticker');
    if (t != null) input.technical = { score: t };
    if (f != null) input.fundamental = { score: f };
    if (s != null) input.sentiment = { score: s };
    if (b != null) input.bandarmologi = { score: b };
    if (tickerIdx !== -1) input.ticker = args[tickerIdx + 1];
  }

  console.log(JSON.stringify(calculateQuantScore(input), null, 2));
}

module.exports = {
  calculateQuantScore,
  scoreTechnical,
  scoreFundamental,
  scoreSentiment,
  scoreBandarmologi,
  scoreBandarmology: scoreBandarmologi,
  resolveRating,
  WEIGHTS,
  RATING_BANDS,
};
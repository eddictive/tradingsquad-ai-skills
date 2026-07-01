"""
Master Quant Score (360° Evaluation) — deterministic 100-point composite.

Weights (institutional-analyst final report):
  Technical Momentum     20%  (0–20)
  Fundamental & Value    20%  (0–20)
  Catalyst & Sentiment   20%  (0–20)
  Bandarmologi Flow      40%  (0–40)

Spec: core/quant-score-spec.json
"""

import json
import sys

WEIGHTS = {
    "technical": 20,
    "fundamental": 20,
    "sentiment": 20,
    "bandarmologi": 40,
}

RATING_BANDS = [
    {"rating": "STRONG BUY", "minScore": 80},
    {"rating": "BUY", "minScore": 65},
    {"rating": "HOLD", "minScore": 45},
    {"rating": "SELL", "minScore": 30},
    {"rating": "STRONG SELL", "minScore": 0},
]


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def _round1(n):
    return round(n * 10) / 10


def _resolve_rating(total):
    for band in RATING_BANDS:
        if total >= band["minScore"]:
            return band["rating"]
    return "STRONG SELL"


def _normalize_input(input_data=None):
    data = dict(input_data or {})
    if not data.get("bandarmologi") and data.get("bandarmology"):
        data["bandarmologi"] = data["bandarmology"]
    return data


def score_technical(signals=None):
    signals = signals or {}
    if signals.get("score") is not None:
        try:
            return _round1(_clamp(float(signals["score"]), 0, WEIGHTS["technical"]))
        except (TypeError, ValueError):
            pass

    pts = 10.0

    try:
        rsi = float(signals.get("rsi14", signals.get("rsi_14", float("nan"))))
        if rsi == rsi:
            if 40 <= rsi <= 65:
                pts += 4
            elif rsi > 70:
                pts -= 3
            elif rsi < 30:
                pts += 2
    except (TypeError, ValueError):
        pass

    vwap = str(signals.get("vwapStatus") or signals.get("vwap_status") or "").lower()
    if vwap in ("above", "bullish"):
        pts += 3
    elif vwap in ("below", "bearish"):
        pts -= 3

    ma = str(signals.get("maAlignment") or signals.get("ma_alignment") or "").lower()
    if "bull" in ma or "golden" in ma:
        pts += 3
    elif "bear" in ma or "death" in ma:
        pts -= 4

    smc = str(signals.get("smcBias") or signals.get("smc_bias") or "").lower()
    if "bull" in smc or smc == "bos_up":
        pts += 2
    elif "bear" in smc or smc == "bos_down":
        pts -= 2

    return _round1(_clamp(pts, 0, WEIGHTS["technical"]))


def score_fundamental(signals=None):
    signals = signals or {}
    if signals.get("score") is not None:
        try:
            return _round1(_clamp(float(signals["score"]), 0, WEIGHTS["fundamental"]))
        except (TypeError, ValueError):
            pass

    pts = 10.0

    for key in ("peRatio", "pe_ratio"):
        if key in signals:
            try:
                pe = float(str(signals[key]).replace(",", ""))
                if 0 < pe < 12:
                    pts += 4
                elif 12 <= pe <= 25:
                    pts += 2
                elif pe > 40:
                    pts -= 4
            except (TypeError, ValueError):
                pass
            break

    for key in ("pbv", "priceToBook"):
        if key in signals:
            try:
                pbv = float(str(signals[key]).replace(",", ""))
                if 0 < pbv < 1.5:
                    pts += 3
                elif pbv > 4:
                    pts -= 3
            except (TypeError, ValueError):
                pass
            break

    for key in ("roe", "roe_ttm"):
        if key in signals:
            try:
                roe = float(str(signals[key]).replace("%", ""))
                if roe >= 15:
                    pts += 2
                elif roe < 5:
                    pts -= 2
            except (TypeError, ValueError):
                pass
            break

    mos_pct = signals.get("marginOfSafetyPct") or signals.get("margin_of_safety_pct")
    if mos_pct is not None:
        try:
            mos_pct = float(mos_pct)
            if mos_pct >= 20:
                pts += 4
            elif mos_pct >= 10:
                pts += 2
            elif mos_pct < 0:
                pts -= 4
        except (TypeError, ValueError):
            pass
    else:
        mos = signals.get("marginOfSafety") or signals.get("margin_of_safety")
        if mos in ("high", "deep_value"):
            pts += 3
        elif mos == "value_trap":
            pts -= 5

    try:
        price = float(signals.get("currentPrice") or signals.get("current_price"))
        fair = float(signals.get("fairValue") or signals.get("fair_value") or signals.get("nilaiWajar"))
        if fair > 0:
            discount = ((fair - price) / fair) * 100
            if discount >= 15:
                pts += 3
            elif discount < -10:
                pts -= 3
    except (TypeError, ValueError):
        pass

    return _round1(_clamp(pts, 0, WEIGHTS["fundamental"]))


def score_sentiment(signals=None):
    signals = signals or {}
    if signals.get("score") is not None:
        try:
            return _round1(_clamp(float(signals["score"]), 0, WEIGHTS["sentiment"]))
        except (TypeError, ValueError):
            pass

    pts = 10.0

    if signals.get("insiderBuying") or signals.get("insider_buying"):
        pts += 5
    if signals.get("genuineCatalyst") or signals.get("genuine_catalyst"):
        pts += 4
    if signals.get("retailFomo") or signals.get("retail_fomo"):
        pts -= 4
    if signals.get("retailPanic") or signals.get("retail_panic"):
        pts += 2
    if signals.get("manipulativeNoise") or signals.get("manipulative_noise"):
        pts -= 5

    tone = str(signals.get("sentimentBias") or signals.get("sentiment_bias") or "").lower()
    if "bull" in tone or tone == "positive":
        pts += 3
    elif "bear" in tone or tone == "negative":
        pts -= 3

    return _round1(_clamp(pts, 0, WEIGHTS["sentiment"]))


def score_bandarmologi(signals=None):
    signals = signals or {}
    if signals.get("score") is not None:
        try:
            return _round1(_clamp(float(signals["score"]), 0, WEIGHTS["bandarmologi"]))
        except (TypeError, ValueError):
            pass

    pts = 20.0

    flow = str(signals.get("netFlow") or signals.get("net_flow") or signals.get("bias") or "").lower()
    if "accum" in flow or flow == "net_buy":
        pts += 12
    elif "distribut" in flow or flow == "net_sell":
        pts -= 12

    foreign = str(signals.get("foreignFlow") or signals.get("foreign_flow") or "").lower()
    if "buy" in foreign or foreign == "net_foreign_buy":
        pts += 6
    elif "sell" in foreign or foreign == "net_foreign_sell":
        pts -= 6

    if signals.get("cornering") or signals.get("cornering_detected"):
        pts += 4
    if signals.get("shakeout"):
        pts += 3
    if signals.get("fakeout"):
        pts -= 8

    sms = signals.get("smartMoneyScore") or signals.get("smart_money_score")
    if sms is not None:
        try:
            pts = (float(sms) / 100) * WEIGHTS["bandarmologi"]
        except (TypeError, ValueError):
            pass

    return _round1(_clamp(pts, 0, WEIGHTS["bandarmologi"]))


def score_bandarmology(signals=None):
    return score_bandarmologi(signals)


def calculate_quant_score(input_data=None):
    data = _normalize_input(input_data)

    technical = score_technical(data.get("technical"))
    fundamental = score_fundamental(data.get("fundamental"))
    sentiment = score_sentiment(data.get("sentiment"))
    bandarmologi = score_bandarmologi(data.get("bandarmologi"))

    total = _round1(technical + fundamental + sentiment + bandarmologi)
    rating = _resolve_rating(total)
    fund = data.get("fundamental") or {}

    return {
        "ticker": data.get("ticker"),
        "totalQuantScore": total,
        "quantScore": total,
        "maxScore": 100,
        "rating": rating,
        "weights": WEIGHTS,
        "breakdown": {
            "technicalMomentum": {
                "score": technical,
                "max": WEIGHTS["technical"],
                "weight": "20%",
                "source": "technical-analyst",
            },
            "fundamentalValue": {
                "score": fundamental,
                "max": WEIGHTS["fundamental"],
                "weight": "20%",
                "source": "fundamental-analyst",
                "fairValue": fund.get("fairValue") or fund.get("fair_value") or fund.get("nilaiWajar"),
                "marginOfSafetyPct": fund.get("marginOfSafetyPct") or fund.get("margin_of_safety_pct"),
            },
            "catalystSentiment": {
                "score": sentiment,
                "max": WEIGHTS["sentiment"],
                "weight": "20%",
                "source": "sentiment-analyst",
            },
            "bandarmologiFlow": {
                "score": bandarmologi,
                "max": WEIGHTS["bandarmologi"],
                "weight": "40%",
                "source": "institutional-analyst",
            },
        },
        "methodology": "Master Quant Score 360°",
        "spec": "core/quant-score-spec.json",
    }


if __name__ == "__main__":
    if "--help" in sys.argv or "-h" in sys.argv:
        print("quant_score.py — Master Quant Score (360° Evaluation)")
        print("\nEngines (sum = 100):")
        print("  Technical Momentum     20 pts  --technical")
        print("  Fundamental & Value    20 pts  --fundamental")
        print("  Catalyst & Sentiment   20 pts  --sentiment")
        print("  Bandarmologi Flow      40 pts  --bandarmologi  (alias: --bandarmology)")
        print("\nUsage:")
        print("  python3 quant_score.py --technical 15 --fundamental 14 --sentiment 11 --bandarmologi 32 --ticker BBCA")
        print("  python3 quant_score.py --input .data/temp/bbca_quant_input.json")
        print("\nRatings: STRONG BUY (≥80) · BUY (≥65) · HOLD (≥45) · SELL (≥30) · STRONG SELL (<30)")
        sys.exit(0)

    data = {}
    if "--input" in sys.argv:
        idx = sys.argv.index("--input")
        if idx + 1 < len(sys.argv):
            with open(sys.argv[idx + 1], "r") as f:
                data = json.load(f)
    else:
        def _flag(name):
            if name in sys.argv:
                i = sys.argv.index(name)
                if i + 1 < len(sys.argv):
                    return float(sys.argv[i + 1])
            return None

        t = _flag("--technical")
        f = _flag("--fundamental")
        s = _flag("--sentiment")
        b = _flag("--bandarmologi") or _flag("--bandarmology")
        if t is not None:
            data["technical"] = {"score": t}
        if f is not None:
            data["fundamental"] = {"score": f}
        if s is not None:
            data["sentiment"] = {"score": s}
        if b is not None:
            data["bandarmologi"] = {"score": b}
        if "--ticker" in sys.argv:
            i = sys.argv.index("--ticker")
            if i + 1 < len(sys.argv):
                data["ticker"] = sys.argv[i + 1]

    print(json.dumps(calculate_quant_score(data), indent=2))
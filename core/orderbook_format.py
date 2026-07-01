"""Normalize Stockbit orderbook to 10-level BID/OFFER boards (matches BEI / Stockbit app)."""

ORDERBOOK_DEPTH = 10
SHARES_PER_LOT = 100


def shares_to_lots(shares):
    try:
        n = float(shares)
    except (TypeError, ValueError):
        return 0
    if n <= 0:
        return 0
    return round(n / SHARES_PER_LOT)


def _parse_side(side=None):
    side = side or {}
    rows = []
    for i in range(1, ORDERBOOK_DEPTH + 1):
        price = side.get(f"price{i}")
        if price is None or price == "":
            continue
        volume_shares = float(side.get(f"volume{i}") or 0)
        rows.append(
            {
                "level": i,
                "price": float(price),
                "volumeShares": volume_shares,
                "volumeLots": shares_to_lots(volume_shares),
                "queueCount": int(float(side.get(f"que_num{i}") or 0)),
            }
        )
    return rows


def format_orderbook(data=None):
    data = data or {}
    bid = _parse_side(data.get("bid"))
    offer = _parse_side(data.get("offer"))
    total_bid_lots = sum(row["volumeLots"] for row in bid)
    total_offer_lots = sum(row["volumeLots"] for row in offer)
    bid_offer_ratio = (
        round(total_bid_lots / total_offer_lots, 2) if total_offer_lots > 0 else None
    )

    last_price = data.get("lastprice") or data.get("close")
    return {
        "symbol": data.get("symbol") or data.get("symbol_2"),
        "lastPrice": float(last_price) if last_price is not None else None,
        "depth": ORDERBOOK_DEPTH,
        "bid": bid,
        "offer": offer,
        "totals": {
            "bidLots": total_bid_lots,
            "offerLots": total_offer_lots,
            "bidOfferRatio": bid_offer_ratio,
        },
    }
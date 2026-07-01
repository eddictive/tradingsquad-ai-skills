"""
Rule of 5 — cap list outputs to top 5 brokers/items for optimal LLM signal-to-noise.
See docs/ARCHITECTURE.md §3.
"""

RULE_OF_FIVE = 5


def clamp_limit(limit=None, default_limit=RULE_OF_FIVE):
    if limit is None:
        return default_limit
    try:
        n = int(limit)
    except (TypeError, ValueError):
        return default_limit
    if n < 1:
        return default_limit
    return min(n, RULE_OF_FIVE)


def trim_to_rule_of_five(items, limit=RULE_OF_FIVE):
    if not isinstance(items, list):
        return items
    return items[:limit]
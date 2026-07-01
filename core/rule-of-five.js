/**
 * Rule of 5 — cap list outputs to top 5 brokers/items for optimal LLM signal-to-noise.
 * See docs/ARCHITECTURE.md §3.
 */

const RULE_OF_FIVE = 5;

function clampLimit(limit, defaultLimit = RULE_OF_FIVE) {
  if (limit == null) return defaultLimit;
  const n = Number(limit);
  if (Number.isNaN(n) || n < 1) return defaultLimit;
  return Math.min(n, RULE_OF_FIVE);
}

function trimToRuleOfFive(items, limit = RULE_OF_FIVE) {
  if (!Array.isArray(items)) return items;
  return items.slice(0, limit);
}

module.exports = { RULE_OF_FIVE, clampLimit, trimToRuleOfFive };
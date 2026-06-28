/**
 * IDX Trading Day Checker
 *
 * Loads the holiday calendar from: core/idx-holidays.json
 * To update holidays: edit that JSON file only — no code changes needed.
 *
 * Source of truth: Official BEI announcement (Kalender Libur Bursa),
 * published annually around September/October.
 *
 * Exit codes: 0 = Market Open, 1 = Market Closed
 */

const fs   = require('fs');
const path = require('path');

// ─── Load Holiday Calendar ────────────────────────────────────────────────────
// Resolve core/idx-holidays.json relative to this script's location,
// walking up from skills/market-scanner/scripts/ → project root → core/
function loadHolidays() {
  const candidates = [
    // Installed locally: .agents/skills/market-scanner/scripts/ → .agents/core/
    path.resolve(__dirname, '../../../core/idx-holidays.json'),
    // Running from cloned repo root
    path.resolve(process.cwd(), 'core/idx-holidays.json'),
    // Fallback: same directory as script (if user copies it alongside)
    path.resolve(__dirname, 'idx-holidays.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed.holidays || {};
      } catch (e) {
        console.error(`⚠️  Failed to parse ${p}: ${e.message}`);
        process.exit(1);
      }
    }
  }

  console.error('❌ Could not find core/idx-holidays.json. Please ensure it exists in the core/ directory.');
  process.exit(1);
}

const IDX_HOLIDAYS = loadHolidays();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWIBDate(overrideDate) {
  if (overrideDate) {
    // Accept YYYY-MM-DD passed as argument
    if (!/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
      console.error('❌ Invalid date format. Use YYYY-MM-DD (e.g. 2026-08-17)');
      process.exit(1);
    }
    const d = new Date(overrideDate + 'T00:00:00Z');
    return {
      dateStr: overrideDate,
      dayOfWeek: d.getUTCDay(),
      dayName: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getUTCDay()],
    };
  }
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return {
    dateStr: `${y}-${m}-${d}`,
    dayOfWeek: now.getUTCDay(),
    dayName: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getUTCDay()],
  };
}

function getLastTradingDay(fromDateStr) {
  const d = new Date(fromDateStr + 'T00:00:00Z');
  for (let i = 0; i < 14; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const candidate = `${y}-${m}-${dd}`;
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !IDX_HOLIDAYS[candidate]) {
      return candidate;
    }
  }
  return 'unknown';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function check() {
  const overrideDate = process.argv[2] || null;
  const { dateStr, dayOfWeek, dayName } = getWIBDate(overrideDate);

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`📅 WEEKEND — Market Closed`);
    console.log(`   Today            : ${dayName}, ${dateStr} (WIB)`);
    console.log(`   Last Trading Day : ${getLastTradingDay(dateStr)}`);
    process.exit(1);
  }

  const holidayName = IDX_HOLIDAYS[dateStr];
  if (holidayName) {
    console.log(`🎌 PUBLIC HOLIDAY — Market Closed: ${holidayName}`);
    console.log(`   Today            : ${dateStr} (WIB)`);
    console.log(`   Last Trading Day : ${getLastTradingDay(dateStr)}`);
    process.exit(1);
  }

  console.log(`✅ MARKET OPEN`);
  console.log(`   Today            : ${dayName}, ${dateStr} (WIB)`);
  process.exit(0);
}

check();

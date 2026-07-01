#!/usr/bin/env node
/**
 * Validates core/idx-holidays.json covers the current calendar year.
 * Exit 0 = OK, 1 = missing year entries (warn).
 */
const fs = require('fs');
const path = require('path');

function findHolidayFile() {
  const candidates = [
    path.join(__dirname, '..', 'core', 'idx-holidays.json'),
    path.join(process.cwd(), 'core', 'idx-holidays.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function checkHolidayCalendar(year = new Date().getFullYear()) {
  const filePath = findHolidayFile();
  if (!filePath) {
    return { ok: false, year, message: 'Could not find core/idx-holidays.json' };
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const holidays = raw.holidays || {};
  const prefix = `${year}-`;
  const count = Object.keys(holidays).filter((d) => d.startsWith(prefix)).length;

  if (count === 0) {
    return {
      ok: false,
      year,
      count,
      filePath,
      message: `No holiday entries for ${year}. BEI typically publishes next year's calendar around Sep/Oct — update core/idx-holidays.json.`,
    };
  }

  return {
    ok: true,
    year,
    count,
    filePath,
    message: `Holiday calendar has ${count} entries for ${year}.`,
  };
}

if (require.main === module) {
  const yearArg = process.argv[2] ? Number(process.argv[2]) : new Date().getFullYear();
  const result = checkHolidayCalendar(yearArg);
  if (result.ok) {
    console.log(`✅ ${result.message}`);
    process.exit(0);
  }
  console.warn(`⚠️  ${result.message}`);
  process.exit(1);
}

module.exports = { checkHolidayCalendar };
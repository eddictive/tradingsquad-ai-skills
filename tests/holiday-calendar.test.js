const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkHolidayCalendar } = require('../scripts/check-holiday-calendar');

describe('holiday-calendar', () => {
  it('has entries for 2026', () => {
    const result = checkHolidayCalendar(2026);
    assert.equal(result.ok, true);
    assert.ok(result.count > 0);
  });

  it('warns when a year has no entries', () => {
    const result = checkHolidayCalendar(1999);
    assert.equal(result.ok, false);
    assert.match(result.message, /No holiday entries/);
  });
});
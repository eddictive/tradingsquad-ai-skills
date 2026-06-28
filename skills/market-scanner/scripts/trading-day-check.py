"""
IDX Trading Day Checker

Loads the holiday calendar from: core/idx-holidays.json
To update holidays: edit that JSON file only — no code changes needed.

Source of truth: Official BEI announcement (Kalender Libur Bursa),
published annually around September/October.

Exit codes: 0 = Market Open, 1 = Market Closed
"""

import sys
import json
import os
from datetime import datetime, timezone, timedelta, date


# ─── Load Holiday Calendar ────────────────────────────────────────────────────
# Resolve core/idx-holidays.json relative to this script's location,
# walking up from skills/market-scanner/scripts/ → project root → core/
def load_holidays() -> dict:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        # Installed locally: .agents/skills/market-scanner/scripts/ → .agents/core/
        os.path.join(script_dir, '..', '..', '..', 'core', 'idx-holidays.json'),
        # Running from cloned repo root
        os.path.join(os.getcwd(), 'core', 'idx-holidays.json'),
        # Fallback: same directory as script
        os.path.join(script_dir, 'idx-holidays.json'),
    ]

    for p in candidates:
        p = os.path.normpath(p)
        if os.path.exists(p):
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return data.get('holidays', {})
            except Exception as e:
                print(f'⚠️  Failed to parse {p}: {e}', file=sys.stderr)
                sys.exit(1)

    print('❌ Could not find core/idx-holidays.json. Please ensure it exists in the core/ directory.', file=sys.stderr)
    sys.exit(1)


IDX_HOLIDAYS = load_holidays()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_wib_date(override_date: str = None) -> date:
    if override_date:
        try:
            return datetime.strptime(override_date, '%Y-%m-%d').date()
        except ValueError:
            print(f'\u274c Invalid date format. Use YYYY-MM-DD (e.g. 2026-08-17)', file=sys.stderr)
            sys.exit(1)
    wib_tz = timezone(timedelta(hours=7))
    return datetime.now(wib_tz).date()


def get_last_trading_day(from_date: date) -> str:
    candidate = from_date
    for _ in range(14):
        candidate -= timedelta(days=1)
        date_str = candidate.strftime('%Y-%m-%d')
        if candidate.weekday() < 5 and date_str not in IDX_HOLIDAYS:
            return date_str
    return 'unknown'


# ─── Main ─────────────────────────────────────────────────────────────────────

def check():
    override_date = sys.argv[1] if len(sys.argv) > 1 else None
    today = get_wib_date(override_date)
    date_str = today.strftime('%Y-%m-%d')
    day_name = today.strftime('%A')

    if today.weekday() >= 5:
        print(f'📅 WEEKEND — Market Closed')
        print(f'   Today            : {day_name}, {date_str} (WIB)')
        print(f'   Last Trading Day : {get_last_trading_day(today)}')
        sys.exit(1)

    holiday_name = IDX_HOLIDAYS.get(date_str)
    if holiday_name:
        print(f'🎌 PUBLIC HOLIDAY — Market Closed: {holiday_name}')
        print(f'   Today            : {date_str} (WIB)')
        print(f'   Last Trading Day : {get_last_trading_day(today)}')
        sys.exit(1)

    print(f'✅ MARKET OPEN')
    print(f'   Today            : {day_name}, {date_str} (WIB)')
    sys.exit(0)


if __name__ == '__main__':
    check()

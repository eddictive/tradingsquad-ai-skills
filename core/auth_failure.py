"""Shared auth-failure messaging for auth-check and agent instructions."""

AUTH_SETUP_STEPS = [
    "Log in to stockbit.com in your browser",
    "Open DevTools (F12) → Application → Cookies → https://stockbit.com",
    "Copy the credentialStorage value",
    "Paste it into .stockbit_token.json in your workspace root",
]

FORBIDDEN_ON_AUTH_FAILURE = [
    "Run any *-api scripts or delegate to sub-agents",
    "Use web search, scraping, or third-party sites as Stockbit substitutes",
    "Use cached .data/temp/ files or prior session outputs",
    "Try alternate auth paths, env workarounds, or custom fetchers",
    "Produce partial, synthetic, or 'best effort' analysis reports",
]


def is_auth_related_error(message=""):
    import re

    return bool(
        re.search(
            r"401|403|unauthorized|authentication required|token refresh|refresh token|invalid token|expired token|failed to load or refresh token",
            message or "",
            re.I,
        )
    )


def build_auth_failure_payload(code, message, token_file, help_text=None):
    return {
        "ok": False,
        "code": code,
        "action": "STOP_PIPELINE",
        "message": message,
        "tokenFile": token_file,
        "help": help_text
        or "See docs/INSTALLATION.md — refresh credentialStorage from Stockbit browser",
        "userAction": AUTH_SETUP_STEPS,
        "forbidden": FORBIDDEN_ON_AUTH_FAILURE,
    }


def print_auth_failure_banner(payload):
    import sys

    print("⛔ PIPELINE HALTED — STOCKBIT AUTH REQUIRED", file=sys.stderr)
    print("", file=sys.stderr)
    print(f"Reason : {payload['message']}", file=sys.stderr)
    if payload.get("tokenFile"):
        print(f"Token  : {payload['tokenFile']}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Fix (required before any analysis):", file=sys.stderr)
    for i, step in enumerate(payload["userAction"], 1):
        print(f"  {i}. {step}", file=sys.stderr)
    print(f"  → Full guide: {payload['help']}", file=sys.stderr)
    print("", file=sys.stderr)
    print("Agent instruction: STOP immediately. Do NOT:", file=sys.stderr)
    for item in payload["forbidden"]:
        print(f"  • {item}", file=sys.stderr)
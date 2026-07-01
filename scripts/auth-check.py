#!/usr/bin/env python3
"""BYOT auth preflight — run ONCE per pipeline/session (orchestrator), not per sub-skill."""
import json
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "core")))
from stockbit_auth import StockbitClient
from auth_preflight import is_preflight_valid, write_preflight_stamp, PREFLIGHT_TTL_SEC
from auth_failure import build_auth_failure_payload, print_auth_failure_banner, is_auth_related_error

SETUP_HELP = (
    "docs/INSTALLATION.md — paste credentialStorage from Stockbit browser "
    "DevTools into .stockbit_token.json"
)


def emit_auth_failure(payload, json_out=False, quiet=False):
    if not quiet:
        if json_out:
            print(json.dumps(payload, indent=2))
        else:
            print_auth_failure_banner(payload)
    return {**payload, "exitCode": 1}


def run_auth_check(json_out=False, quiet=False, verify_network=True, skip_if_valid=False):
    token_path = os.path.join(os.getcwd(), ".stockbit_token.json")

    if not os.path.exists(token_path):
        return emit_auth_failure(
            build_auth_failure_payload(
                "TOKEN_MISSING",
                "No .stockbit_token.json in workspace.",
                token_path,
                SETUP_HELP,
            ),
            json_out=json_out,
            quiet=quiet,
        )

    if skip_if_valid and is_preflight_valid(token_path):
        cached = {
            "ok": True,
            "code": "AUTH_OK_CACHED",
            "skipped": True,
            "message": "Preflight already valid for this session (orchestrator ran auth-check).",
            "tokenFile": token_path,
            "ttlSec": PREFLIGHT_TTL_SEC,
        }
        if not quiet:
            if json_out:
                print(json.dumps(cached, indent=2))
            else:
                print("✅ STOCKBIT AUTH OK (cached preflight — skip re-check in same pipeline)")
        return {**cached, "exitCode": 0}

    client = StockbitClient()
    try:
        client.login()
        result = {
            "ok": True,
            "code": "AUTH_OK",
            "tokenFile": client.token_file,
            "username": client.username,
            "accessExpiresAt": client.access_expired_at,
        }

        if verify_network:
            try:
                profile = client.get_profile()
                p = profile.get("data", {}).get("profile", {})
                result["username"] = p.get("username") or result["username"]
                result["networkVerified"] = True
            except Exception as e:
                if is_auth_related_error(str(e)):
                    return emit_auth_failure(
                        build_auth_failure_payload(
                            "TOKEN_INVALID",
                            str(e),
                            client.token_file,
                            SETUP_HELP,
                        ),
                        json_out=json_out,
                        quiet=quiet,
                    )
                result["networkVerified"] = False
                result["networkWarning"] = str(e)

        write_preflight_stamp(token_path, {"username": result.get("username")})

        if not quiet:
            if json_out:
                print(json.dumps(result, indent=2))
            else:
                print("✅ STOCKBIT AUTH OK")
                print(f"   Token file : {result['tokenFile']}")
                if result.get("username"):
                    print(f"   User       : @{result['username']}")
                if result.get("networkVerified"):
                    print("   API check  : profile verified")
                elif result.get("networkWarning"):
                    print(f"   API check  : token loaded; profile skipped ({result['networkWarning']})")
                print("   Note       : sub-agents should NOT re-run auth-check in the same pipeline")

        return {**result, "exitCode": 0}
    except Exception as e:
        return emit_auth_failure(
            build_auth_failure_payload(
                "TOKEN_INVALID",
                str(e),
                client.token_file,
                SETUP_HELP,
            ),
            json_out=json_out,
            quiet=quiet,
        )


def print_auth_check_help():
    print("auth-check.py — BYOT token preflight (once per pipeline, not per sub-skill)")
    print("\nUsage:")
    print("  python3 scripts/auth-check.py")
    print("  python3 scripts/auth-check.py --skip-if-valid")
    print("\nPipeline: trading-day-check → auth-check (1×) → all *-api.py scripts")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--help" in args or "-h" in args:
        print_auth_check_help()
        sys.exit(0)

    result = run_auth_check(
        json_out="--json" in args,
        quiet="--quiet" in args,
        verify_network="--no-network" not in args,
        skip_if_valid="--skip-if-valid" in args,
    )
    sys.exit(result["exitCode"])
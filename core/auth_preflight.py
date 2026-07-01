"""Session auth-preflight stamp — avoids redundant auth-check in multi-agent pipelines."""
import json
import os
import time

PREFLIGHT_TTL_SEC = 30 * 60


def get_stamp_path(cwd=None):
    cwd = cwd or os.getcwd()
    return os.path.join(cwd, ".data", "temp", ".auth-preflight.json")


def read_preflight_stamp(cwd=None):
    stamp_path = get_stamp_path(cwd)
    if not os.path.exists(stamp_path):
        return None
    try:
        with open(stamp_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def write_preflight_stamp(token_path, extra=None):
    stamp_path = get_stamp_path()
    os.makedirs(os.path.dirname(stamp_path), exist_ok=True)
    payload = {
        "ok": True,
        "checkedAt": int(time.time() * 1000),
        "tokenFile": token_path,
        "tokenMtime": os.path.getmtime(token_path),
        **(extra or {}),
    }
    with open(stamp_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(payload, indent=2) + "\n")
    return payload


def _resolve_path_safe(p):
    try:
        return os.path.realpath(p)
    except OSError:
        return os.path.abspath(p)


def is_preflight_valid(token_path, cwd=None):
    stamp = read_preflight_stamp(cwd)
    if not stamp or not stamp.get("ok"):
        return False
    if (time.time() * 1000) - stamp.get("checkedAt", 0) > PREFLIGHT_TTL_SEC * 1000:
        return False
    if not os.path.exists(token_path):
        return False
    if _resolve_path_safe(stamp.get("tokenFile", "")) != _resolve_path_safe(token_path):
        return False
    if stamp.get("tokenMtime") != os.path.getmtime(token_path):
        return False
    return True
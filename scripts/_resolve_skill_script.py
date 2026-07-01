#!/usr/bin/env python3
"""Resolve skill script paths across cloned-repo and installed CLI layouts."""
import os
import subprocess
import sys

INSTALL_ROOTS = (".agents", ".grok", ".claude", ".codex", ".skills")


def resolve_skill_script(skill_name, script_name, root=None):
    if root is None:
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

    candidates = [os.path.join(root, "skills", skill_name, "scripts", script_name)]
    for install_root in INSTALL_ROOTS:
        candidates.append(
            os.path.join(root, install_root, "skills", skill_name, "scripts", script_name)
        )

    return next((p for p in candidates if os.path.exists(p)), None)


def run_skill_script(skill_name, script_name):
    target = resolve_skill_script(skill_name, script_name)
    if not target:
        print(
            f"❌ Could not find {skill_name}/scripts/{script_name}. Run install-skills.js first.",
            file=sys.stderr,
        )
        sys.exit(1)

    result = subprocess.run([sys.executable, target, *sys.argv[1:]])
    sys.exit(result.returncode)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: _resolve_skill_script.py <skill-name> <script-name> [args...]", file=sys.stderr)
        sys.exit(1)
    run_skill_script(sys.argv[1], sys.argv[2])
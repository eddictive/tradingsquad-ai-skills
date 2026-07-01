#!/usr/bin/env python3
"""Workspace shim → core/quant_score.py"""
import os
import sys
import subprocess

target = os.path.join(os.path.dirname(__file__), "..", "core", "quant_score.py")
result = subprocess.run([sys.executable, target, *sys.argv[1:]])
sys.exit(result.returncode)
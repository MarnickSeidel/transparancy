#!/usr/bin/env bash
# Entry point for Cursor Automations / cloud agents (Linux uses python3).
set -euo pipefail
cd "$(dirname "$0")"
python3 -m pip install -q -r requirements.txt
python3 run_monthly_refresh.py "$@"

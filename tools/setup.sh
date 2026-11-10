#!/usr/bin/env bash
# setup.sh - ONLINE / Linux setup (claude.ai/code cloud session). Run once at the start:  bash tools/setup.sh
# Installs Python packages into .venv and npm packages for the app. Takes 2-4 minutes.
set -e
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install -q --upgrade pip
.venv/bin/python -m pip install -q fastapi "uvicorn[standard]" pydantic python-multipart httpx pandas numpy \
  pytest "psycopg[binary]==3.2.3"
for d in round1/frontend; do
  [ -f "$d/package.json" ] && (cd "$d" && npm install --silent --no-audit --no-fund) &
done
wait
echo "OK  setup done. Start an app with: bash tools/run_app.sh round1"

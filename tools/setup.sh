#!/usr/bin/env bash
# setup.sh - ONLINE / Linux setup (claude.ai/code cloud session). Run once at the start:  bash tools/setup.sh
# Installs Python packages into .venv and npm packages in kit + round folders. Takes 2-4 minutes.
set -e
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install -q --upgrade pip
.venv/bin/python -m pip install -q fastapi "uvicorn[standard]" pydantic python-multipart httpx pandas numpy \
  scikit-learn python-pptx python-docx matplotlib pytest openpyxl pillow pymupdf
for d in kit/frontend round1/frontend round2/frontend; do
  [ -f "$d/package.json" ] && (cd "$d" && npm install --silent --no-audit --no-fund) &
done
wait
echo "OK  setup done. Start an app with: bash tools/run_app.sh round1"

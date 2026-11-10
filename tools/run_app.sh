#!/usr/bin/env bash
# run_app.sh - ONLINE / Linux: start backend (8000) + frontend (5173) of a round in the background.
#   bash tools/run_app.sh round1        stop:  bash tools/stop_app.sh
cd "$(dirname "$0")/.."
R="${1:-round1}"
mkdir -p "$R/logs"
bash tools/stop_app.sh >/dev/null 2>&1
(cd "$R/backend" && nohup ../../.venv/bin/python -m uvicorn app.main:app --reload --reload-dir app --port 8000 --host 0.0.0.0 > ../logs/api.log 2>&1 &)
(cd "$R/frontend" && nohup npx vite --port 5173 --strictPort --host > ../logs/web.log 2>&1 &)
for i in $(seq 1 60); do
  sleep 0.7
  if curl -s -m 2 http://127.0.0.1:8000/api/health >/dev/null && curl -s -m 2 http://127.0.0.1:5173/ >/dev/null; then
    echo "OK  app running: http://localhost:5173  (API http://localhost:8000/docs)"; exit 0
  fi
done
echo "NOT READY - logs:"; tail -n 15 "$R/logs/api.log" "$R/logs/web.log"; exit 1

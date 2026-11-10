#!/usr/bin/env bash
# stop_app.sh - ONLINE / Linux: stop the app servers started by run_app.sh
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "vite --port 5173" 2>/dev/null
echo "OK  stopped"

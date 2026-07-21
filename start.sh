#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; test -f "$root/.env" || { echo 'Missing .env; copy .env.example.' >&2; exit 1; }
test -d "$root/backend/node_modules" && test -d "$root/frontend/node_modules" || { echo 'Dependencies missing; run scripts/bootstrap.sh.' >&2; exit 1; }
(cd "$root/backend" && npm start) & backend_pid=$!; (cd "$root/frontend" && npm run dev -- --host) & frontend_pid=$!
cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }; trap cleanup EXIT INT TERM; wait "$backend_pid" "$frontend_pid"

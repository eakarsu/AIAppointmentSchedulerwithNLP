#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; test -f "$root/.env" || { echo 'Missing .env; copy .env.example.' >&2; exit 1; }
set -a; source "$root/.env"; set +a
: "${BACKEND_PORT:?BACKEND_PORT is required}" "${FRONTEND_PORT:?FRONTEND_PORT is required}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
: "${OPENROUTER_BASE_URL:?OPENROUTER_BASE_URL is required}"
[ "$OPENROUTER_BASE_URL" = "https://openrouter.ai/api/v1" ] || { echo 'OPENROUTER_BASE_URL must be https://openrouter.ai/api/v1' >&2; exit 1; }
test -d "$root/backend/node_modules" && test -d "$root/frontend/node_modules" || { echo 'Dependencies missing; run scripts/bootstrap.sh.' >&2; exit 1; }
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $port is occupied; refusing to terminate another process." >&2; exit 1; fi; done
if [ "${MIGRATE_ON_START:-false}" = true ]; then
  case "${ALLOW_SCHEMA_MIGRATION:-}" in 1|true) ;; *) echo 'ALLOW_SCHEMA_MIGRATION=1 or true is required for startup migration.' >&2; exit 1;; esac
  (cd "$root/backend" && npm run migrate)
fi
(cd "$root/backend" && npm run create-admin)
(cd "$root/backend" && npm start) & backend_pid=$!; (cd "$root/frontend" && npm run dev -- --host --port "$FRONTEND_PORT") & frontend_pid=$!
cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }; trap cleanup EXIT INT TERM; wait "$backend_pid" "$frontend_pid"

#!/bin/bash
set -Eeuo pipefail

PORT=5001
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT=5001

cd "${COZE_WORKSPACE_PATH}"

kill_port_if_listening() {
    local pids
    if command -v lsof >/dev/null 2>&1; then
      pids=$(lsof -ti tcp:"${DEPLOY_RUN_PORT}" 2>/dev/null || true)
    else
      pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    fi
    if [[ -z "${pids}" ]]; then
      echo "Port ${DEPLOY_RUN_PORT} is free."
      return
    fi
    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    kill -9 ${pids} 2>/dev/null || true
    sleep 1
}

echo "Clearing port ${PORT} before start."
kill_port_if_listening
echo "Starting HTTP service on port ${PORT} for dev..."

if command -v pnpm >/dev/null 2>&1; then
  pnpm vite --port "$PORT" --strictPort
else
  npx vite --port "$PORT" --strictPort
fi

#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only
else
  npm install --ignore-scripts
fi

echo "Building the project..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm vite build
else
  npx vite build
fi

echo "Build completed successfully!"

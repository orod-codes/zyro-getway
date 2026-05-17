#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if command -v adb >/dev/null 2>&1; then
  adb reverse tcp:3000 tcp:3000 || true
fi
npm start

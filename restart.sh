#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${SSPRO_PID_FILE:-$ROOT_DIR/static/sspro-node.pid}"
PORT_FILE="${SSPRO_PORT_FILE:-$ROOT_DIR/static/sspro-node.port}"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "Stopping PID $PID..."
    kill "$PID" || true
    sleep 0.3
  fi
fi

rm -f "$PORT_FILE"
"$ROOT_DIR/start.sh"

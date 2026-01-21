#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${SSPRO_PORT:-3216}"
NODE_BIN="${SSPRO_NODE_BIN:-/usr/bin/node}"
LOG_FILE="${SSPRO_LOG_FILE:-$ROOT_DIR/static/sspro-node.log}"
PID_FILE="${SSPRO_PID_FILE:-$ROOT_DIR/static/sspro-node.pid}"
PORT_FILE="${SSPRO_PORT_FILE:-$ROOT_DIR/static/sspro-node.port}"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "Node not found at $NODE_BIN"
  exit 1
fi

mkdir -p "$ROOT_DIR/static"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    RUNNING_PORT=""
    if [[ -f "$PORT_FILE" ]]; then
      RUNNING_PORT="$(cat "$PORT_FILE" || true)"
    fi
    if [[ -n "${RUNNING_PORT:-}" ]]; then
      echo "Server already running (PID $PID, port $RUNNING_PORT)."
    else
      echo "Server already running (PID $PID)."
    fi
    exit 0
  fi
fi

find_free_port() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("", 0))
print(s.getsockname()[1])
s.close()
PY
    return
  fi
  echo ""
}

if lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  NEW_PORT="$(find_free_port)"
  if [[ -n "${NEW_PORT:-}" ]]; then
    PORT="$NEW_PORT"
  else
    echo "Port $PORT already in use, and no free port could be auto-selected."
    exit 1
  fi
fi

export NODE_ENV=production
export SSPRO_PORT="$PORT"
export PORT="$PORT"
export PUPPETEER_EXECUTABLE_PATH="${PUPPETEER_EXECUTABLE_PATH:-/usr/bin/chromium}"

echo "Starting Screenshot Pro on port $PORT..."
(
  cd "$ROOT_DIR"
  "$NODE_BIN" index.js >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  echo "$PORT" >"$PORT_FILE"
)

sleep 0.2
echo "PID $(cat "$PID_FILE")"
echo "Log: $LOG_FILE"
echo "Open: http://localhost:$PORT/"

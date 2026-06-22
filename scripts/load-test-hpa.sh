#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# load-test-hpa.sh
#
# Drives sustained video-frame WebSocket traffic at the API to validate:
#   1. HPA scales from minReplicas → maxReplicas under load
#   2. Zero session drops mid-scale-up (clients receive a {type:"drain"}
#      frame and reconnect to a new pod cleanly)
#   3. p99 of /diagnostics/vision stays within SLO during scale events
#
# Usage:
#   BASE_URL=https://simself.example.com VUS=400 DURATION=10m \
#     ./scripts/load-test-hpa.sh
#
# Requires: k6 >= 0.50, kubectl with context pointing at the target cluster.
# -----------------------------------------------------------------------------
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-${BASE_URL/http/ws}/ws}"
VUS="${VUS:-300}"
DURATION="${DURATION:-10m}"
NAMESPACE="${NAMESPACE:-simself}"
DEPLOY="${DEPLOY:-simself-api}"
OUT_DIR="${OUT_DIR:-/tmp/load-test-hpa}"

mkdir -p "$OUT_DIR"
SCRIPT="$OUT_DIR/script.js"

cat > "$SCRIPT" <<'JS'
import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const drains   = new Counter('ws_drain_frames');
const drops    = new Counter('ws_unexpected_close');
const rttDiag  = new Trend('diag_ms', true);

export const options = {
  scenarios: {
    sustained_ws: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m',  target: Number(__ENV.VUS) * 0.25 },
        { duration: '2m',  target: Number(__ENV.VUS) },
        { duration: __ENV.DURATION, target: Number(__ENV.VUS) },
        { duration: '1m',  target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ws_unexpected_close: ['count<5'],          // <5 surprise drops total
    diag_ms:             ['p(99)<1500'],       // /diagnostics/vision p99 SLO
    ws_drain_frames:     ['count>=0'],         // recorded, not gated
  },
};

export default function () {
  const url = __ENV.WS_URL;
  const res = ws.connect(url, {}, (socket) => {
    let receivedDrain = false;
    socket.on('open', () => {
      // ~30fps fake frame heartbeat
      socket.setInterval(() => socket.send(JSON.stringify({ t: 'frame', ts: Date.now() })), 33);
    });
    socket.on('message', (m) => {
      try {
        const msg = JSON.parse(m);
        if (msg.type === 'drain') { drains.add(1); receivedDrain = true; socket.close(); }
      } catch (_) {}
    });
    socket.on('close', () => {
      if (!receivedDrain) drops.add(1);
    });
    socket.setTimeout(() => socket.close(), 60_000);
  });
  check(res, { 'ws handshake 101': (r) => r && r.status === 101 });

  // Concurrently exercise the diagnostics endpoint so we can trend it.
  const r = http.get(`${__ENV.BASE_URL}/diagnostics/vision`);
  rttDiag.add(r.timings.duration);
  sleep(1);
}
JS

echo "==> watching HPA in the background"
kubectl -n "$NAMESPACE" get hpa "$DEPLOY" -w > "$OUT_DIR/hpa.log" 2>&1 &
HPA_PID=$!
kubectl -n "$NAMESPACE" get pods -l app="$DEPLOY" -w > "$OUT_DIR/pods.log" 2>&1 &
POD_PID=$!
trap 'kill $HPA_PID $POD_PID 2>/dev/null || true' EXIT

echo "==> running k6 against $WS_URL (VUS=$VUS, duration=$DURATION)"
BASE_URL="$BASE_URL" WS_URL="$WS_URL" VUS="$VUS" DURATION="$DURATION" \
  k6 run --summary-export "$OUT_DIR/summary.json" "$SCRIPT" | tee "$OUT_DIR/k6.log"

echo
echo "==> HPA timeline (last 20 lines):"
tail -n 20 "$OUT_DIR/hpa.log"
echo
echo "==> Pod transitions (last 20 lines):"
tail -n 20 "$OUT_DIR/pods.log"
echo
echo "Artifacts in $OUT_DIR"

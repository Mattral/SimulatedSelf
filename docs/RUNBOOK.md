# Runbook — Simulated Self API

Production incident response for the `api` service. Pair with
`docs/SYSTEM_DESIGN.md` for architectural context.

---

## 1. Probe contract recap

| Probe | Path | Failure semantics |
|---|---|---|
| Liveness | `GET /healthz` | Process restart by kubelet after `failureThreshold` |
| Readiness | `GET /readyz` | Pod removed from Service endpoints; rollout halts |
| Startup | `GET /healthz` | Grace period before live/ready start |
| Diagnostics | `GET /diagnostics/vision` | Operator-triggered model URL preflight |
| Metrics | `GET /metrics` | Prometheus scrape target |
| OpenAPI | `GET /openapi.json`, `GET /docs` | Live API contract + Swagger UI |

`/readyz` aggregates three checks:

```json
{
  "ok": false,
  "ts": 1730000000000,
  "checks": {
    "redis":  { "ok": false, "error": "redis.ping timeout 250ms" },
    "ws":     { "ok": true,  "active": 12, "softCap": 500 },
    "models": { "ok": false, "failed": ["face_expression_model-weights_manifest.json (HTTP 404)"] }
  }
}
```

Any sub-check `ok=false` ⇒ HTTP 503 ⇒ pod **NotReady**.

---

## 2. Triage flow

```text
alert: api readiness failing
  │
  ├─► kubectl -n simulated-self get pods -l app=api
  ├─► kubectl -n simulated-self logs <pod> | grep '[readyz] NOT READY'
  │       └─ JSON line identifies which sub-check failed
  │
  ├─► Redis ......... section 3
  ├─► WebSockets .... section 4
  └─► Model URLs .... section 5
```

---

## 3. Redis failure

**Signal**: `checks.redis.ok=false`, `error` contains `timeout` or `ECONNREFUSED`.

**Causes**
- StatefulSet pod evicted or OOMKilled.
- Network policy blocking egress from `api` to `redis` Service.
- AOF rewrite stalling Redis (>250 ms ping).

**Recovery**
1. `kubectl -n simulated-self get pods -l app=redis` — confirm `Running`.
2. `kubectl -n simulated-self exec redis-0 -- redis-cli ping` — expect `PONG`.
3. If `PONG` but probe still fails: check NetworkPolicy / DNS:
   `kubectl -n simulated-self exec deploy/api -- nslookup redis`.
4. If Redis is down: `kubectl -n simulated-self rollout restart statefulset/redis`.
5. Sessions are cache-only — no data loss; reconnects rehydrate from Supabase.

**Prevent regression**: alert on `redis_ping_latency_ms{quantile="0.99"} > 200`.

---

## 4. WebSocket saturation

**Signal**: `checks.ws.ok=false`, `active >= softCap`.

**Causes**
- Sudden client connection spike.
- HPA lagging because `websocket_active_connections` external metric
  pipeline is stalled.

**Recovery**
1. Scale immediately: `kubectl -n simulated-self scale deploy/api --replicas=<n>`.
2. Verify HPA: `kubectl -n simulated-self describe hpa api` — look for
   "unable to get metric" events on the `websocket_active_connections` Pods metric.
3. If metric pipeline broken: temporarily raise `WS_SOFT_CAP` env via
   `kubectl set env deploy/api WS_SOFT_CAP=1000` while fixing the adapter.

---

## 5. Model URL failure

**Signal**: `checks.models.ok=false`, `failed[]` lists manifests with
`HTTP 404` / `HTTP 403` / `timeout`.

**Causes**
- CDN/object-storage permissions changed (S3 bucket policy, signed URL expiry).
- `MODEL_BASE_URL` env points to a deploy that hasn't shipped the assets yet.
- Frontend `web` pod (which serves `/models/*` in-cluster) not yet ready.

**Recovery**
1. Run the operator preflight: `curl -s https://<api>/diagnostics/vision | jq`.
2. From a debug pod: `curl -I "$MODEL_BASE_URL/tiny_face_detector_model-weights_manifest.json"`.
3. If `web` is the upstream: `kubectl -n simulated-self rollout status deploy/web`.
4. If CDN ACL drift: re-apply the bucket policy module; invalidate edge cache.
5. Confirm green: `curl -fsS https://<api>/readyz | jq .checks.models.ok` → `true`.

---

## 6. Rollback

```bash
kubectl -n simulated-self rollout undo deploy/api
kubectl -n simulated-self rollout status deploy/api --timeout=120s
```

Readiness gating (`maxUnavailable: 0`) guarantees the previous good
ReplicaSet is still serving while the rollback drains the new pods.

---

## 7. Observability quick links

- Prometheus: `redis_ping_latency_ms`, `model_preflight_duration_ms`,
  `websocket_active_connections`, `vision_preflight_failures_total`.
- Logs: structured JSON, `[readyz] NOT READY {...}` lines are the
  canonical probe-failure record.
- Dashboards: `Simulated-Self / API health` (Grafana folder).

---
## Drain & shutdown (added with K8s hardening)

The API pod transitions through these states on `kubectl rollout restart` /
node drain:

1. **`preStop` fires** → `wget http://127.0.0.1:8081/drain`. Server flips
   `draining=true`, `/readyz` starts returning 503, and every active WS
   gets a `{"type":"drain"}` frame so clients reconnect through the LB
   to a healthy pod.
2. **kube-proxy / ingress remove the pod from endpoints** (~5–10s).
3. **`SIGTERM`** — server waits `DRAIN_GRACE_MS` (default 15s), closes
   any sockets still open with code `1001 shutdown`, then exits.

`terminationGracePeriodSeconds: 60` gives this whole sequence headroom.
If pods are being SIGKILLed, raise the grace period or lower
`DRAIN_GRACE_MS`.

## OpenTelemetry correlation

Every response carries `x-request-id` and `x-trace-id`. To find a trace
from a user-reported error:

```bash
kubectl logs -n simulated-self -l app=api --tail=10000 | grep <x-request-id>
# then open Tempo / Jaeger at trace=<x-trace-id>
```

WebSocket sessions inherit `traceparent` from the upgrade request, so a
single trace spans SPA → API → Redis → LLM.

## HPA scaling load-test verification

Run before any release that changes WebSocket session affinity, the drain
hook, or the HPA target metric. Confirms that scale-up under sustained
video traffic does not drop client sessions.

```bash
BASE_URL=https://staging.simself.example.com \
  VUS=400 DURATION=10m \
  ./scripts/load-test-hpa.sh
```

Pass criteria:

| Signal                                    | Threshold                       |
| ----------------------------------------- | ------------------------------- |
| `ws_unexpected_close` (k6 counter)        | < 5 over the whole run          |
| `ws_drain_frames` received                | ≥ 1 per scale-down event        |
| `/diagnostics/vision` p99 latency         | < 1500 ms                       |
| HPA `currentReplicas`                     | rises within 60 s of saturation |
| Pod transitions in `pods.log`             | `Running → Terminating` only after a drain frame was sent |

If `ws_unexpected_close > 0`:
1. Inspect `pods.log` for `Terminating` pods that lacked a preceding
   `drain` frame in `k6.log`.
2. Check `kubectl describe pod <name>` for `preStop` exit codes.
3. Raise `terminationGracePeriodSeconds`, or shorten `DRAIN_GRACE_MS`,
   so the broadcast completes before the pod is killed.

Pose-quality SLO regressions show up here too: a sudden jump in
`pose_calibration_failure_rate` or `one_euro_filter_fallback_total`
during the run usually means the new pods are cold-starting models —
warm them via the readiness probe before the HPA marks them Ready.

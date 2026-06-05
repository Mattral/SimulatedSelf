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

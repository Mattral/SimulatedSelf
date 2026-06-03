# System Design — Simulated Self

> Operational + architectural reference for the Simulated-Self
> human-modeling research platform. Written to FAANG-tier review
> standards: explicit contracts, failure modes, scaling envelopes,
> and observability hooks.

---

## 1. Goals & Non-Goals

| Goal | Notes |
|---|---|
| Sub-150 ms perception → render loop (camera → pose/emotion → 3D rig) | Browser-side, off main thread |
| Zero-downtime rollouts | K8s `RollingUpdate`, deep readiness probes |
| Reproducible local + CI builds | Bun lockfile + cached Docker layers |
| Operator-grade diagnostics | `/healthz`, `/readyz`, `/diagnostics/vision`, edge fn mirror |
| Horizontal scale on WS connection count | HPA custom metric `websocket_active_connections` |

Non-goals: server-side ML inference (kept in browser worker), durable
chat persistence (Redis is cache-only, source-of-truth is Supabase).

---

## 2. Topology

```text
                ┌───────────────────────┐
                │  Browser (Vite SPA)   │
                │  React + Three.js     │
                │  ├ vision.worker.ts ──┼──► face-api models (/models/*)
                │  ├ useMicLevel        │
                │  └ useMediaPipePose   │
                └─────────┬─────────────┘
                          │ WSS  /api/ws
                          ▼
                ┌───────────────────────┐
                │  API gateway (Bun)    │ ──► Lovable AI Gateway (LLM)
                │  apps/api/src/*       │
                │  /healthz /readyz     │
                │  /diagnostics/vision  │
                └─────────┬─────────────┘
                          │
                          ▼
                ┌───────────────────────┐       ┌────────────────────┐
                │  Redis (StatefulSet)  │       │  Supabase          │
                │  session ctx cache    │       │  edge fns + auth   │
                │  AOF + RDB persist    │       │  vision-diagnostics│
                └───────────────────────┘       └────────────────────┘
```

---

## 3. Process & Concurrency Model

- **Main thread**: React render + Three.js. Never blocks on ML.
- **Web Worker** (`src/workers/vision.worker.ts`): face-api inference;
  ImageBitmap transferable in, flat emotion payload out. Init does a
  fail-fast HTTP preflight against `/models/*.json` so misconfigured
  deployments surface a structured `MODEL_LOAD_FAILED` instead of a
  cryptic tfjs stack.
- **API**: Bun's single-threaded event loop; CPU-bound work is
  offloaded to upstream LLM. HPA scales out, not up.

---

## 4. Probe Contracts

| Path | Code | Body | Semantics |
|---|---|---|---|
| `/healthz` | 200 | `{ok, ts}` | Process alive. Used by `livenessProbe`. |
| `/readyz` | 200 / 503 | `{ok, checks:{redis,ws,models?}}` | Deep readiness. Pod is removed from Service endpoints on 503; rollout pauses. Failures are logged to stdout with full context for kubelet log scraping. |
| `/diagnostics/vision` | 200 / 503 | `{ok, models:[…]}` | On-demand model-URL preflight; mirrored by Supabase edge fn `vision-diagnostics`. |

Readiness uses a 250 ms Redis ping timeout and 500 ms HEAD per model
URL — total worst-case probe latency ≈ 1.25 s, well under the K8s
`timeoutSeconds` budget.

---

## 5. Failure Domains

| Domain | Detector | Behaviour |
|---|---|---|
| Redis down | `/readyz` `checks.redis.ok=false` | Pod marked NotReady → traffic shifted → HPA does not scale up unhealthy pods. |
| Model assets missing | Worker `MODEL_LOAD_FAILED` + `/diagnostics/vision` 503 | UI shows actionable banner; backend `/readyz` reports `checks.models.failed[]`. |
| WS saturation | `checks.ws.active > softCap` | Readiness flips 503 on hot pod; HPA already scaling on `websocket_active_connections` custom metric. |
| LLM API rate-limit | Per-request catch in API | 429 surfaced to UI; backoff with jitter; no retries on idempotency-unsafe verbs. |

---

## 6. Build & Release

```text
PR opened ──► CI (.github/workflows/ci.yml)
              ├─ bun install --frozen-lockfile  (cache key = bun.lockb)
              ├─ lint + tsc --noEmit
              ├─ vision-worker smoke (bundle + model URL resolve)
              ├─ vite build
              └─ docker build (Dockerfile, BuildKit cache mount)
```

Docker images are multi-stage; the `deps` stage is keyed solely on
`package.json + bun.lockb` so source-only changes never re-resolve
dependencies. BuildKit `--mount=type=cache,target=/root/.bun/install/cache`
persists the Bun cache across runs locally and in CI (`type=gha`).

Rollout strategy: `maxSurge=1, maxUnavailable=0` with `startupProbe`
to absorb cold-start jitter; readiness gating prevents serving
traffic until Redis + WS + models are green.

---

## 7. Observability

- **Stdout-structured logs**: probe failures emit single-line JSON.
- **Prometheus**: pod annotations `prometheus.io/scrape: "true"`
  on the API deployment; the WS connection gauge feeds the HPA.
- **UI diagnostics**: `MoodDisplay` polls `vision-diagnostics`
  every 30 s and renders per-model status inline.

---

## 8. Local Development

```bash
# Full stack
docker compose up --build

# Backend tests (mocked fetch, no Redis required)
docker compose --profile test run --rm api-test

# Vision worker smoke (bundles worker + checks model files)
docker compose --profile test run --rm smoke

# Browser E2E (Playwright, fake camera/mic)
docker compose --profile test run --rm e2e
```

---

## 9. Testing Pyramid

| Tier | Tool | Location | Purpose |
|---|---|---|---|
| Unit (frontend) | Vitest + Testing Library | `src/**/*.test.tsx` | Component contracts, hook reducers |
| Unit (backend) | `bun test` | `apps/api/src/*.test.ts` | Preflight logic, readiness aggregator (mocked deps) |
| API contract | `bun test` | `apps/api/src/server.test.ts` | Spawns server, drives real HTTP for `/healthz`, `/readyz`, `/diagnostics/vision` |
| E2E | Playwright | `tests/e2e/*.spec.ts` | Real browser, fake media, asserts canvas + mood panel |
| Build-time smoke | `bun scripts/vision-worker-smoke.ts` | CI | Worker bundles + model manifests resolve |

---

## 10. Open Risks & Follow-ups

- WS session count is in-process; a multi-pod readiness signal should
  read the HPA's external metric pipeline rather than process-local
  state once we add sticky-session affinity.
- The `e2e` compose service uses an upstream Playwright image and
  `npx playwright` — pin to a workspace-local `@playwright/test`
  devDep once we standardise the test runner across packages.
- Redis is a single replica; before multi-region we need Sentinel or
  a managed equivalent.

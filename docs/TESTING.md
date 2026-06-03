# Testing Guide

Five tiers, each runnable locally and in CI.

## 1. Frontend unit (Vitest + RTL)

```bash
bunx vitest run
```

Location: `src/**/*.{test,spec}.{ts,tsx}` (see `vitest.config.ts`).
Setup: `src/test/setup.ts` polyfills `matchMedia` for jsdom.

## 2. Backend unit (Bun test, mocked deps)

```bash
cd apps/api && bun test src/vision-preflight.test.ts
```

`runVisionPreflight` is fully pure — pass a mocked `fetch` to assert
per-manifest accounting without network or Redis.

## 3. Backend API contract (Bun test, real HTTP)

```bash
cd apps/api && bun test src/server.test.ts
```

Spawns the API on a random port and drives `/healthz`, `/readyz`,
`/diagnostics/vision`. Redis intentionally unreachable so we assert
the structured 503 contract.

## 4. Browser E2E (Playwright)

```bash
bunx playwright test                                # local
docker compose --profile test run --rm e2e          # hermetic
```

Uses `--use-fake-ui-for-media-stream` so camera/mic permissions
auto-grant. Tests live in `tests/e2e/`.

## 5. Build-time vision-worker smoke

```bash
bun run smoke:vision-worker
```

Validates that `src/workers/vision.worker.ts` bundles AND that every
face-api weights manifest + referenced `.bin` is present in
`public/models/`. Runs on every PR before `vite build`.

## CI matrix

`.github/workflows/ci.yml` runs install → lint → typecheck → model
assets check → vision-worker smoke → build → docker build.

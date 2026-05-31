# Repository & Infrastructure Refactor

## 1. Package Manager Consolidation (Bun is the source of truth)

```bash
# Run from the repo root.
rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml
bun install                        # regenerates bun.lockb
git add bun.lockb package.json
```

The `engines` block in `package.json` now refuses `npm/yarn/pnpm` so a
contributor accidentally running `npm install` will fail fast.

## 2. Hook & Component Deduplication (deleted files)

| Removed                                  | Replaced by                          |
| ---------------------------------------- | ------------------------------------ |
| `src/hooks/useFaceExpression.ts`         | `src/hooks/useFacialEmotion.ts`      |
| `src/hooks/useFacialEmotionDetection.ts` | `src/hooks/useFacialEmotion.ts`      |
| `src/hooks/useAdvancedEmotionDetection.ts` | `src/hooks/useEmotionAnalytics.ts` |
| `src/hooks/useImprovedEmotionDetection.ts` | `src/hooks/useEmotionAnalytics.ts` |
| `src/components/ImprovedMoodDisplay.tsx` | `src/components/MoodDisplay.tsx`     |

The new `useEmotionAnalytics` is the canonical implementation — it runs
@vladmandic/face-api inside `src/workers/vision.worker.ts` and exposes
both React state and a `latestRef` mutable handle for the render loop.

## 3. Unused shadcn primitives

The audit (`rg` over `src/` excluding `src/components/ui/`) found the
following primitives with **zero external imports**. Delete to reduce
lint surface and bundle weight:

```
accordion alert alert-dialog aspect-ratio avatar badge breadcrumb
button calendar card carousel chart checkbox collapsible command
context-menu dialog drawer dropdown-menu form hover-card input
input-otp label menubar navigation-menu pagination popover progress
radio-group resizable scroll-area select separator sheet sidebar
skeleton slider switch table tabs textarea toggle toggle-group
use-toast
```

In use: `sonner`, `toast`, `toaster`, `tooltip`. (`use-toast` is the
hook companion to `toast/toaster` — keep `src/hooks/use-toast.ts` and
delete only the duplicate `src/components/ui/use-toast.ts`.)

```bash
cd src/components/ui
rm -f accordion.tsx alert.tsx alert-dialog.tsx aspect-ratio.tsx \
      avatar.tsx badge.tsx breadcrumb.tsx button.tsx calendar.tsx \
      card.tsx carousel.tsx chart.tsx checkbox.tsx collapsible.tsx \
      command.tsx context-menu.tsx dialog.tsx drawer.tsx \
      dropdown-menu.tsx form.tsx hover-card.tsx input.tsx \
      input-otp.tsx label.tsx menubar.tsx navigation-menu.tsx \
      pagination.tsx popover.tsx progress.tsx radio-group.tsx \
      resizable.tsx scroll-area.tsx select.tsx separator.tsx \
      sheet.tsx sidebar.tsx skeleton.tsx slider.tsx switch.tsx \
      table.tsx tabs.tsx textarea.tsx toggle.tsx toggle-group.tsx \
      use-toast.ts
```

> Left deliberately untouched for now so you can confirm nothing
> dynamic-imports them; the command is your one-liner to execute.

## 4. Vision Worker Offload

```
┌──────────────┐  ImageBitmap   ┌──────────────────────┐
│  Index.tsx   │ ──────────────▶│  vision.worker.ts    │
│ getUserMedia │   (transfer)   │  • TinyFaceDetector  │
│ <video>      │                │  • FaceExpressionNet │
│              │◀── emotion ────│  (OffscreenCanvas)   │
└──────┬───────┘   {7 classes}  └──────────────────────┘
       │
       ▼ landmarksRef (mutable, 30Hz)
   Scene3D / SkeletonRenderer  ── imperative, no React render
```

- **Zero-copy**: `createImageBitmap(video)` + `postMessage(bitmap, [bitmap])`.
- **No React re-renders on the hot path**: `useEmotionAnalytics.latestRef` and `useMediaPipePoseDetection.landmarksRef` are mutable; React state is updated only every `RENDER_THROTTLE_MS = 100ms` for HUD components.
- **MediaPipe caveat**: the JS Pose/Hands solutions require DOM canvas + WASM that does not initialize inside Workers as of this writing. They remain on the main thread but their callbacks now write into a ref and throttle React updates to ~10Hz.

## 5. Containerization & Orchestration

```
deploy/
├── nginx/nginx.conf            # gzip, immutable caching, CSP headers
├── k8s/
│   ├── deployment.yaml         # web + api + HPA (CPU + ws connections)
│   ├── service.yaml            # ClusterIP services
│   ├── ingress.yaml            # / -> web, /api/ws -> api (sticky)
│   └── redis.yaml              # StatefulSet + AOF/RDB persistence
Dockerfile                      # Bun build -> nginx alpine runtime
Dockerfile.api                  # Node 20 alpine, non-root, distroless-style
```

### Build & push

```bash
docker build -t ghcr.io/your-org/simulated-self-web:$(git rev-parse --short HEAD) .
docker build -f Dockerfile.api -t ghcr.io/your-org/simulated-self-api:$(git rev-parse --short HEAD) .
docker push ghcr.io/your-org/simulated-self-web:...
docker push ghcr.io/your-org/simulated-self-api:...
```

### Apply manifests

```bash
kubectl apply -f deploy/k8s/
kubectl -n simulated-self create secret generic api-secrets \
  --from-literal=GROQ_API_KEY=...
kubectl -n simulated-self create secret generic redis-secrets \
  --from-literal=password=...
```

### HPA targets

- CPU avg utilization > 65% → scale.
- Custom metric `websocket_active_connections` > 250/pod → scale.
  Emit this metric from the API gateway via `prom-client`; wire to
  `prometheus-adapter` so the HPA can consume it.

### Ingress stickiness

`/api/ws` uses the NGINX cookie affinity (`SIMSELF_WS`) so a given
client always lands on the same API pod for the duration of its
WebSocket — critical for in-memory voice/LLM streaming state.

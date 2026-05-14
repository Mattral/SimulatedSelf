# Architecture

> Document owner: Min Htet Myet · Last reviewed: 2026-05-14
> Audience: engineers onboarding to the codebase.

## 1. System overview

Simulated Self is a single-page browser application. There is no backend in
the canonical deployment — every perception pipeline runs locally on the
user's device. The only remote dependency is the Groq inference endpoint
used by the conversational layer.

```text
                    ┌──────────────────────────────────────────────┐
                    │                  Browser                     │
   Webcam ──▶ getUserMedia ──┬─▶ MediaPipe Holistic ──▶ landmarks  │
                              │                                    │
                              ├─▶ face-api.js ───────▶ expression  │
                              │                                    │
                              └─▶ <video> ──▶ WebcamFeed component │
                                                                   │
   Microphone ─▶ Web Speech API ─▶ transcript ──▶ Groq SDK (HTTPS) │
                                                  │                │
                                                  ▼                │
                                          streaming tokens         │
                                                  │                │
                                                  ▼                │
                              SpeechSynthesisUtterance ─▶ Speaker  │
                                                                   │
   landmarks + expression + status ──▶ Three.js Scene3D ──▶ Canvas │
                    └──────────────────────────────────────────────┘
```

## 2. Module map

| Path                                         | Responsibility                                                  |
|----------------------------------------------|------------------------------------------------------------------|
| `src/pages/Index.tsx`                        | Top-level orchestrator; wires hooks into the 3D scene & UI HUD. |
| `src/components/Scene3D.tsx`                 | Three.js renderer, orbit controls, imperative handle.            |
| `src/components/SkeletonRenderer.tsx`        | Pose retargeting, humanoid vs. landmark mode switching.          |
| `src/components/HumanoidRobot.tsx`           | Loaded GLB humanoid + sub-managers (face, fingers, limbs).       |
| `src/components/VoiceChatPanel.tsx`          | Glass-morphism HUD for the voice state machine.                  |
| `src/hooks/usePoseDetection.ts`              | MediaPipe lifecycle + landmark stream.                           |
| `src/hooks/useImprovedEmotionDetection.ts`   | face-api.js lifecycle + expression smoothing.                    |
| `src/hooks/useVoiceInteraction.ts`           | Speech I/O state machine + streaming AI integration.             |
| `src/services/geminiService.ts`              | Groq SDK wrapper: streaming, retry, timeout, error mapping.      |

## 3. Cross-cutting concerns

### 3.1 State ownership

- All long-lived perception state lives in **hooks** (`usePoseDetection`,
  `useImprovedEmotionDetection`, `useVoiceInteraction`).
- Three.js owns its own mutable scene graph; React talks to it through an
  **imperative handle** on `Scene3D` (`updateSkeletonPose`, `updateEmotion`,
  `setHumanoidMode`). This avoids re-rendering the canvas on every frame.

### 3.2 Failure isolation

Each pipeline is independent. A failure in the AI stream does not stop pose
tracking. A failure in pose tracking does not stop voice chat. Users can
re-grant permissions or retry without reloading the page.

### 3.3 Performance budget

| Pipeline       | Budget             | Strategy                                    |
|----------------|--------------------|---------------------------------------------|
| Render         | 16.6 ms (60 fps)   | Three.js animation loop, no React re-render |
| Pose detection | 33 ms (30 fps)     | MediaPipe runs on a worker-style loop       |
| Emotion        | 80 ms              | Throttled via `setInterval(800 ms)`         |
| AI first token | 600 ms             | `stream: true`, no buffering                |

## 4. Extension points

- **Swap the LLM** — implement the `generateResponseStream` contract in
  `src/services/geminiService.ts`. Anything that yields `string` chunks works.
- **Swap the renderer** — `Scene3D` exposes the `updateSkeletonPose` and
  `updateEmotion` imperative methods; replace the internals with Babylon.js,
  R3F, etc., as long as the contract holds.
- **Add a new perception channel** — create a hook that returns a `data`
  ref + `start`/`stop` actions and pass its output to `Scene3D` via a new
  imperative method.

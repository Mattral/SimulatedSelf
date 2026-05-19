# Research Report — Simulated Self

> Author: Min Htet Myet · Last revised: 2026-05-19
> Status: Internal research note. Scope is restricted to techniques **actually
> implemented in this repository**; speculative extensions are explicitly
> labelled.

---

## 0. Abstract

*Simulated Self* is a single-page web application that ingests a single RGB
webcam stream plus a microphone and produces a co-present, real-time
**digital twin** rendered as a 3D humanoid. The system is built around two
research themes:

1. **Human Modeling and Augmentation** — recovering body/hand pose and
   facial-expression state from a 2D image stream, retargeting that state to
   a skeletal humanoid, and exposing controls that let a user explore a
   mirrored representation of themselves.
2. **Extension of Human Sensory/Motor Functions** — pairing the visual
   pipeline with a streaming speech ↔ language-model ↔ speech loop so the
   avatar becomes a conversational partner whose presence is contingent on
   the user's body, voice, and affect.

The system is intentionally **browser-native and zero-backend** (apart from
the LLM endpoint), trading model capacity for latency, privacy, and
deployability. This document describes the methodology, the engineering
trade-offs, the limitations we currently inherit, and a comparison of the
techniques that we evaluated and shipped.

---

## 1. System under study

### 1.1 Inputs

| Modality          | Sensor                         | Sampling                                  |
|-------------------|--------------------------------|-------------------------------------------|
| RGB video         | `getUserMedia({ video })`      | Camera-default, typically 640×480 @ 30 fps |
| Microphone audio  | `getUserMedia({ audio })`      | 48 kHz, mono, with browser AEC/NS/AGC      |
| Spoken prompts    | `webkitSpeechRecognition`      | Continuous, interim results               |

### 1.2 Outputs

| Channel                | Implementation                                                                     |
|------------------------|------------------------------------------------------------------------------------|
| 3D humanoid pose       | `THREE.Group` driven by MediaPipe landmarks (`SkeletonRenderer`, `HumanoidRobot`)  |
| Facial affect mirror   | `FaceManager` blendshape-style updates from `useImprovedEmotionDetection`          |
| Streamed text response | Groq `llama-3.1-8b-instant`, chunked tokens to a glass HUD                          |
| Spoken response        | `SpeechSynthesisUtterance` queued once the stream terminates                       |
| UI telemetry           | `VoiceChatPanel` (state), `MicLevelMeter` (RMS), status pills (camera/pose/hands)  |

### 1.3 Pipeline at a glance

```
            ┌──── MediaPipe Pose  (33 landmarks) ────┐
RGB video ──┤                                       ├──► SkeletonRenderer ──► HumanoidRobot (Three.js)
            ├──── MediaPipe Hands (21 × 2)           │
            └──── face-api.js (7-class expression) ──┘

Mic audio ─► Web Speech API ─► transcript ─► Groq stream ─► tokens ─► HUD
                                                              └─► SpeechSynthesis ─► speaker

Mic audio ─► AnalyserNode (RMS) ─► MicLevelMeter (UI)
```

---

## 2. Theme 1 — Human Modeling and Augmentation

### 2.1 Problem statement

Given a monocular RGB stream, produce a 3D representation of the user that
(a) is temporally stable enough to drive a humanoid avatar at interactive
frame rates, (b) covers body, hands, and face simultaneously, and (c) runs
fully inside a commodity browser without backend offload.

### 2.2 Methodology

#### 2.2.1 Body and hand pose

We use **MediaPipe Pose** (33 landmarks) and **MediaPipe Hands** (21 per
hand) loaded lazily from `cdn.jsdelivr.net` at runtime
(`src/hooks/useMediaPipePoseDetection.ts`). Each landmark is `{x, y, z,
visibility?}` in normalised image space; `z` is a relative depth estimate
from MediaPipe's regression head and is **not metric**.

Connection topology is encoded explicitly in
`src/components/SkeletonRenderer.tsx` (`POSE_CONNECTIONS`,
`HAND_CONNECTIONS`) so we never depend on MediaPipe's drawing utility for
the 3D scene.

#### 2.2.2 Retargeting to a humanoid

`SkeletonRenderer` and `HumanoidRobot` share a `THREE.Group`. The humanoid
exposes seven sub-managers, each responsible for a slice of state:

| Sub-manager          | Responsibility                                              |
|----------------------|--------------------------------------------------------------|
| `ModelLoader`        | Loads the GLB shell                                          |
| `LimbManager`        | Arm/leg bone rotations from pose landmarks                   |
| `ShoulderManager`    | Clavicle/shoulder corrections to stabilise upper-body chain  |
| `FingerManager`      | Per-finger rotations from hand landmarks                     |
| `FaceManager`        | Expression-driven facial updates                             |
| `MaterialManager`    | Material/shader state                                        |
| `VisibilityManager`  | Toggles between humanoid mode and raw landmark mode          |

This decomposition keeps each transformation small and locally testable; it
also lets us swap individual managers (e.g. a different finger retargeting
algorithm) without touching the rest of the pipeline.

#### 2.2.3 Facial affect

`useImprovedEmotionDetection` uses `@vladmandic/face-api`'s
`tinyFaceDetector` + `faceExpressionNet`. We deliberately chose this
combination because:

- TinyFaceDetector at `inputSize=416, scoreThreshold=0.5` runs comfortably
  on the CPU/Wasm backend used in the browser.
- The expression network returns the canonical seven-class probability
  vector (`happy, sad, angry, surprised, neutral, fearful, disgusted`).

Predictions are sampled on a **400 ms interval** (not per-frame) and pushed
through a **temporal smoother** that keeps the last 6 predictions or
predictions newer than 2.5 s — whichever is smaller. The dominant emotion
is the one maximising `count × mean_confidence`, and the state only
publishes when the dominant class changes or confidence exceeds 0.6. This
is a deliberate trade-off: we accept higher latency on rare expressions
(e.g. fearful) in exchange for stability against single-frame noise that
would otherwise cause the avatar's face to flicker.

### 2.3 Comparison of techniques considered

| Decision                                                              | What we shipped                                                 | What we explicitly rejected                                                                              | Reason                                                                                          |
|-----------------------------------------------------------------------|------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Pose detector                                                         | MediaPipe Pose + Hands                                          | MediaPipe Holistic single graph; BlazePose GHUM full mesh; OpenPose server                                | Holistic raises latency budget per frame; OpenPose needs a server; GHUM not exposed in JS build |
| Face affect                                                           | `@vladmandic/face-api` TinyFaceDetector + FaceExpressionNet      | Larger SSD-MobileNet face detector; AU regression (e.g. OpenFace) | SSD adds ~3× latency in-browser; OpenFace has no first-class web build                          |
| Emotion temporal model                                                | RMS-style "count × mean confidence" window (last 6 / 2.5 s)      | Exponential moving average; HMM/Viterbi over class trajectories                                          | EMA over-weights stale frames at low sampling rate; HMM was out of scope                        |
| Avatar driving                                                        | Direct landmark → bone rotation in `LimbManager` / `FingerManager` | Full inverse kinematics solver (CCD/FABRIK)                                                              | The MediaPipe skeleton is already pose-complete; IK was unnecessary and adds drift              |
| Hand handedness                                                       | User instruction overlay: "flip both palms forward at start"     | Automatic re-labelling per frame                                                                          | MediaPipe's left/right flip under occlusion is unsolved here; the instruction is cheaper        |

Note that we also keep two parallel "advanced" / "improved" emotion hooks
(`useAdvancedEmotionDetection`, `useImprovedEmotionDetection`) so we can
A/B switch detector configurations without losing the older path. Only
**Improved** drives the avatar's face in the current UI.

### 2.4 Limitations (Theme 1)

- **Monocular depth is approximate.** MediaPipe's `z` is a relative
  regression; the humanoid is consequently driven primarily by 2D
  projection and inferred limb orientation, not metric reconstruction.
- **No multi-person support.** All three pipelines assume a single subject.
- **Occlusion** of either hand below the desk or behind the torso causes
  finger sub-manager updates to freeze on the last seen pose.
- **Affect ≠ emotion.** `face-api.js` predicts visual expression
  categories, not internal affective state; "neutral" dominates in normal
  conversation by construction.
- **Lighting sensitivity.** Low-light or backlit conditions degrade
  TinyFaceDetector and the pose graph simultaneously; we surface this only
  indirectly through landmark visibility scores.
- **CDN dependency.** MediaPipe scripts are loaded at runtime from
  jsdelivr; an offline user cannot use the pose pipeline today.

---

## 3. Theme 2 — Extension of Human Sensory/Motor Functions

### 3.1 Problem statement

Augment the user's voice with a low-latency, interruptible conversational
partner that also reflects their physical and affective state, while
running inside the browser-security envelope and respecting a fixed token
budget.

### 3.2 Methodology

#### 3.2.1 Voice capture

The microphone is captured twice, with explicit separation of concerns:

| Consumer              | Hook / module                       | Purpose                                                |
|-----------------------|-------------------------------------|--------------------------------------------------------|
| Speech recognition    | `useVoiceInteraction` → Web Speech API | Continuous transcript with interim results            |
| Loudness telemetry    | `useMicLevel` → `AnalyserNode` (RMS) | Drives the new `MicLevelMeter` and silence detection  |

This separation lets us show "I can't hear you" feedback even when the
SpeechRecognition engine has not yet emitted a result.

#### 3.2.2 Real-time mic level meter (new)

`useMicLevel` opens its own `getUserMedia` stream with
`echoCancellation/noiseSuppression/autoGainControl` enabled, builds an
`AnalyserNode` with `fftSize = 1024` and
`smoothingTimeConstant = 0.6`, and computes **RMS** of the time-domain
buffer per `requestAnimationFrame`. We chose RMS over peak amplitude
because RMS correlates better with perceived loudness and is more
forgiving of transient clicks.

A sliding peak (`peakRef`) decays at ~8 % per 60 ms so the UI shows a
hairline marker without flickering. The hook publishes:

- `level ∈ [0, 1]` — gamma-corrected RMS for UI rendering,
- `peak ∈ [0, 1]` — decaying max,
- `isSilent` — true after 1.5 s below `SILENCE_THRESHOLD = 0.015`,
- `error` and `permissionState` — surfaced as actionable copy in the meter.

#### 3.2.3 Conversational core

`src/services/geminiService.ts` (named for legacy reasons) is a Groq SDK
wrapper exposing an `AsyncGenerator<string>` over Groq's
`chat.completions.create({ stream: true })`. The contract is intentionally
narrow:

- **Model.** `llama-3.1-8b-instant` — chosen for first-token latency, not
  ceiling capability.
- **System prompt.** Bounded to "≤50 words, plain conversational, TTS-safe"
  so TTS does not stall on bullet lists or code.
- **Budget.** `max_completion_tokens = 256` to bound TTS time and cost.
- **Hard timeout.** 15 s via an internal `AbortController`.
- **Retry.** Up to 2 retries with exponential backoff (`300 × 2ⁿ`, capped
  at 2 s) for `429` and `5xx` only; never on user cancel.
- **Errors.** Mapped to a `GroqServiceError` taxonomy
  (`NOT_CONFIGURED | TIMEOUT | NETWORK | UPSTREAM | UNKNOWN`) so the UI
  can decide whether to expose a "Try again" button.

#### 3.2.4 State machine

`useVoiceInteraction` is the single source of truth for the voice loop:

```
idle ──startListening──► listening ──final transcript──► processing
                                                            │
                                                            ▼
                            error ◄──── streaming ◄────── (first token)
                                            │
                                            ▼
                                         speaking ──onend──► idle
```

`cancel()` aborts both the in-flight stream and `speechSynthesis`.
`retry()` re-runs the last prompt. Streaming tokens are accumulated in
`partialResponse` for the HUD and only handed to `SpeechSynthesisUtterance`
after the stream terminates — speaking incremental chunks produces a
choppy prosody profile and was rejected.

### 3.3 Comparison of techniques considered

| Decision                  | What we shipped                                            | What we explicitly rejected                                          | Reason                                                                                  |
|---------------------------|-------------------------------------------------------------|-----------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| LLM provider              | Groq `llama-3.1-8b-instant` (streaming)                    | Google Gemini (the original integration; quota-bound for our key)     | Groq's hosted Llama gives sub-second first-token in practice and is provider-neutral    |
| Streaming UX              | Accumulate tokens in HUD, speak on completion              | Speak each chunk as it arrives                                        | Per-chunk TTS produces choppy prosody and double-trips on `speechSynthesis.cancel()`    |
| Speech in                 | Web Speech API (`webkitSpeechRecognition`)                  | Whisper.cpp WASM in-browser                                           | Whisper WASM models are 100–300 MB and would dominate the per-session download budget   |
| Speech out                | `SpeechSynthesisUtterance`                                  | Cloud TTS (ElevenLabs, Polly)                                         | Adds a paid dependency and a second round-trip; not required for the prototype          |
| Mic level                 | `AnalyserNode` RMS + sliding peak                          | Peak-only meter; FFT-bar visualiser                                   | RMS tracks perceived loudness; bar visualiser implied louder mic state than RMS did     |
| Error handling            | Typed `GroqServiceError` + targeted retry policy           | Generic `try/catch` with toast                                        | We need to distinguish retryable (`429/5xx/timeout`) from terminal (`4xx`/cancel)        |
| Mic permission UX         | Inline tips in the meter referencing the address-bar lock  | Generic "permission denied" alert                                     | Users on Chromium need site-settings instructions, not a modal                          |

### 3.4 Limitations (Theme 2)

- **Browser support skew.** Web Speech API quality (and existence) varies
  significantly across browsers. Chromium delegates to a Google service and
  requires network connectivity; Safari's implementation is on-device but
  less accurate; Firefox has no production support.
- **API key exposure model.** `VITE_GROQ_API_KEY` is inlined into the
  client bundle by Vite at build time. This is acceptable for a personal
  demo but unsafe for public deployment; the documented production path is
  a Lovable Cloud edge function (see `docs/SECURITY.md`).
- **No barge-in.** While the avatar is speaking, the recogniser is paused
  to avoid feedback. A true barge-in would require AEC tuned for the TTS
  output and an explicit cross-channel canceller, which is out of scope.
- **TTS prosody is constrained.** `SpeechSynthesisUtterance` exposes only
  rate/pitch/volume; SSML support across browsers is partial.
- **One-shot context.** The Groq call sends only `{system, user}`; we do
  not yet maintain conversation history. This is deliberate for the demo —
  long histories raise both latency and token cost.

---

## 4. Cross-cutting methodology

### 4.1 Failure isolation

Each pipeline (pose, hands, face affect, voice in, voice out, LLM) owns
its own React hook, its own loading state, and its own error state. A
failure in any one does not block the others — e.g. the AI key being
missing leaves the pose pipeline intact and only disables the voice HUD's
"Generate" path.

### 4.2 Performance budgets

| Pipeline             | Budget per cycle | Mechanism                                          |
|----------------------|------------------|----------------------------------------------------|
| Three.js render      | 16.6 ms (60 fps) | Mutates `THREE.Group` directly; React not involved |
| Pose / hands         | 33 ms (30 fps)   | MediaPipe `onResults` callback                     |
| Facial expression    | 400 ms           | `setInterval`-driven, not per-frame                |
| AI first token       | ≤ 600 ms target  | Groq streaming + no client buffering               |
| Mic meter            | 16.6 ms (rAF)    | RMS over a 1024-sample window                      |

### 4.3 Privacy posture

All vision and audio-level analysis runs **on-device** in the browser; no
frames or audio buffers leave the machine. The only network egress is:

1. MediaPipe + face-api model files (CDN).
2. The textual prompt + system message sent to Groq.
3. The textual completion returned from Groq.

This is documented and reinforced in `docs/SECURITY.md`.

### 4.4 Reproducibility

| Artefact              | Pinned by                                                |
|-----------------------|-----------------------------------------------------------|
| Library versions      | `package.json` + `bun.lockb`                              |
| Model versions        | MediaPipe & face-api CDN URLs (no SHA pin — known risk)   |
| LLM behaviour         | Model id `llama-3.1-8b-instant`, `temperature=0.8`        |
| Sampling cadence      | Hard-coded intervals (400 ms emotion, rAF render/meter)   |

---

## 5. Overall limitations & threats to validity

1. **Single-subject, single-camera assumption.** None of the perception
   pipelines is multi-user.
2. **No metric calibration.** Without a stereo rig or IMU, depth and
   absolute joint angles are approximate.
3. **Affect detection is visual only.** No prosody-based affect from the
   microphone is fused in; the LLM is text-only.
4. **The LLM is non-deterministic and non-grounded.** With
   `temperature=0.8` and no retrieval layer, identical prompts produce
   different replies; the system makes no factual guarantees.
5. **Browser drift.** Web Speech API, AudioWorklet, and `permissions.query
   ({ name: 'microphone' })` semantics change between browser releases;
   regressions show up as silently degraded UX rather than hard failures.
6. **CDN trust.** MediaPipe scripts and face-api weights are loaded from
   third-party CDNs; in principle a compromised CDN could ship hostile
   code into the page.

---

## 6. Future work (explicitly **not** implemented today)

> Listed here for completeness; none of these items are present in the
> repository and they must not be cited as current capabilities.

- LLM call routed through a Lovable Cloud edge function so the API key
  never reaches the browser bundle.
- Multi-turn conversation memory with per-session truncation.
- Audio-prosody affect fusion (e.g. pitch / energy → arousal).
- Barge-in (talk-over) with full-duplex AEC.
- Whisper-WASM transcription as a Firefox fallback.
- IK-corrected limb retargeting for tighter joint constraints.

---

## 7. References to source

| Concept                         | File                                                  |
|---------------------------------|--------------------------------------------------------|
| Pose / hand landmark capture    | `src/hooks/useMediaPipePoseDetection.ts`               |
| Skeleton + humanoid retargeting | `src/components/SkeletonRenderer.tsx`, `src/components/HumanoidRobot.tsx`, `src/components/robot/*` |
| Facial expression               | `src/hooks/useImprovedEmotionDetection.ts`             |
| Voice state machine             | `src/hooks/useVoiceInteraction.ts`                     |
| LLM client                      | `src/services/geminiService.ts`                        |
| Voice HUD                       | `src/components/VoiceChatPanel.tsx`                    |
| Mic level meter                 | `src/hooks/useMicLevel.ts`, `src/components/MicLevelMeter.tsx` |
| Permission onboarding           | `src/components/PermissionHandler.tsx`                 |

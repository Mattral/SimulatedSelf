import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const PIPELINES = {
  pose: {
    title: "Body & hand pose",
    stages: [
      "Webcam frame captured from <video> at ~30Hz",
      "MediaPipe Pose + Hands produce 33 body and 21-per-hand landmarks",
      "Hands are re-ordered into a fixed [leftHand, rightHand] tuple with selfie-mirror label correction",
      "Landmarks written to mutable refs at full rate; React state throttled to ~10Hz",
      "HumanoidRobot converts landmarks to world space (x*4, y*3, z*2) and locks the palm to the pose wrist joint",
    ],
    troubleshooting:
      "If palms look detached, the finger and body z-scales have diverged; both must use z*2.",
  },
  emotion: {
    title: "Facial emotion",
    stages: [
      "Frame transferred to a Web Worker as a zero-copy ImageBitmap",
      "face-api.js TinyFaceDetector (inputSize multiple of 32) + expression net run in the worker",
      "Scores smoothed over a sliding window, with a high-confidence bypass for clear expressions",
      "Brightness-based heuristic fallback if the worker or model weights fail to load",
    ],
    troubleshooting:
      "Check model weights with check_vision_models; tune thresholds in the in-app Emotion Settings panel.",
  },
  calibration: {
    title: "Hand calibration",
    stages: [
      "Collect palm landmark samples across a short capture window",
      "Build an orthonormal basis via SVD from wrist/index/pinky landmarks",
      "Correct handedness for the mirrored selfie view",
      "Apply a One-Euro filter to the resulting quaternion to suppress jitter",
    ],
    troubleshooting: "Drift usually means recalibration is needed under the current lighting.",
  },
  voice: {
    title: "Voice chat",
    stages: [
      "Web Speech API captures and transcribes speech",
      "Transcript streamed to the LLM; tokens surfaced live as partialResponse",
      "AbortController enforces a 15s timeout with exponential-backoff retries",
      "Full reply spoken via speechSynthesis once the stream terminates",
    ],
    troubleshooting: "Missing API configuration surfaces as a NOT_CONFIGURED error in the HUD.",
  },
} as const;

export default defineTool({
  name: "explain_tracking_pipeline",
  title: "Explain a tracking pipeline",
  description:
    "Explain how one of SimSelf's pipelines works (pose, emotion, calibration, voice), including stages and troubleshooting hints.",
  inputSchema: {
    pipeline: z
      .enum(["pose", "emotion", "calibration", "voice"])
      .describe("Which pipeline to explain."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ pipeline }) => {
    const detail = PIPELINES[pipeline];
    return {
      content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
      structuredContent: detail as unknown as Record<string, unknown>,
    };
  },
});

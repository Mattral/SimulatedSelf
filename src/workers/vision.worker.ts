/**
 * vision.worker.ts
 * ---------------------------------------------------------------
 * Dedicated Web Worker that runs the @vladmandic/face-api facial
 * emotion model off the main thread.
 *
 * Why a worker?
 *   - face-api inference is ~30–120ms per frame on mid-tier hardware
 *     and triggers heavy GC on the main thread when run inside React
 *     `setInterval` loops. Offloading to a worker keeps the Three.js
 *     render loop at 60fps and removes jank from the skeleton driver.
 *
 * Transport:
 *   - The main thread captures the current webcam frame into an
 *     OffscreenCanvas or ImageBitmap and posts it as a Transferable.
 *     No memory is copied (zero-copy handoff).
 *   - We post back a compact { emotion, confidence, expressions }
 *     payload that the hook merges into a `useRef` (NOT React state)
 *     so the render loop reads it without re-rendering the tree.
 *
 * MediaPipe Pose note:
 *   The MediaPipe JS pose/hands solutions internally depend on a
 *   DOM-bound canvas + WASM that historically does not initialize in
 *   a Worker context. We therefore keep the MediaPipe pose pipeline
 *   on the main thread but flatten its output through a mutable ref
 *   (see useMediaPipePoseDetection) to bypass React re-renders.
 * ---------------------------------------------------------------
 */

/// <reference lib="webworker" />
import * as faceapi from '@vladmandic/face-api';

type InboundMessage =
  | { type: 'init'; modelUrl: string }
  | { type: 'frame'; bitmap: ImageBitmap; ts: number }
  | { type: 'dispose' };

type OutboundMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | {
      type: 'emotion';
      ts: number;
      emotion: string;
      confidence: number;
      expressions: Record<string, number>;
    };

let initialized = false;
let busy = false;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

async function init(modelUrl: string) {
  if (initialized) return;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
    await faceapi.nets.faceExpressionNet.loadFromUri(modelUrl);
    initialized = true;
    ctx.postMessage({ type: 'ready' } as OutboundMessage);
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      message: `model load failed: ${(err as Error).message}`,
    } as OutboundMessage);
  }
}

async function processFrame(bitmap: ImageBitmap, ts: number) {
  if (!initialized || busy) {
    bitmap.close();
    return;
  }
  busy = true;
  try {
    // OffscreenCanvas is required for face-api to read the bitmap inside a worker.
    const off = new OffscreenCanvas(bitmap.width, bitmap.height);
    const g = off.getContext('2d');
    if (!g) throw new Error('OffscreenCanvas 2D unavailable');
    g.drawImage(bitmap, 0, 0);

    const detections = await faceapi
      .detectAllFaces(
        off as unknown as faceapi.TNetInput,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }),
      )
      .withFaceExpressions();

    if (detections.length > 0) {
      const e = detections[0].expressions as unknown as Record<string, number>;
      let top = 'neutral';
      let best = 0;
      for (const [k, v] of Object.entries(e)) {
        if (v > best) {
          best = v;
          top = k;
        }
      }
      ctx.postMessage({
        type: 'emotion',
        ts,
        emotion: top,
        confidence: best,
        expressions: e,
      } as OutboundMessage);
    }
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      message: (err as Error).message,
    } as OutboundMessage);
  } finally {
    bitmap.close();
    busy = false;
  }
}

ctx.onmessage = (ev: MessageEvent<InboundMessage>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'init':
      void init(msg.modelUrl);
      break;
    case 'frame':
      void processFrame(msg.bitmap, msg.ts);
      break;
    case 'dispose':
      initialized = false;
      break;
  }
};

export {};

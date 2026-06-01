/**
 * vision.worker.ts
 * ---------------------------------------------------------------
 * Dedicated Web Worker that runs the @vladmandic/face-api facial
 * emotion model off the main thread.
 *
 * Runtime self-test:
 *   On `init`, the worker first does a HEAD request to each required
 *   model manifest. If any URL 404s (the most common deployment bug
 *   — models not copied into `public/models/`), we fail fast with an
 *   explicit `error` message *before* face-api tries to load them,
 *   so the UI can show actionable guidance instead of a vague stack.
 *
 * Transport:
 *   Main thread sends an ImageBitmap as a Transferable (zero copy).
 *   Worker replies with a flat { emotion, confidence, expressions }
 *   payload that the hook merges into a `useRef` so the Three.js
 *   render loop reads it without React re-renders.
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
  | { type: 'error'; message: string; code?: string }
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

const REQUIRED_MANIFESTS = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_expression_model-weights_manifest.json',
];

function post(msg: OutboundMessage) {
  ctx.postMessage(msg);
}

async function preflight(modelUrl: string): Promise<void> {
  const base = modelUrl.replace(/\/$/, '');
  for (const file of REQUIRED_MANIFESTS) {
    const url = `${base}/${file}`;
    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', cache: 'no-store' });
    } catch (e) {
      throw new Error(
        `[vision.worker] network error fetching ${url}: ${(e as Error).message}. ` +
          `Check that the dev server / CDN is reachable.`,
      );
    }
    if (!res.ok) {
      throw new Error(
        `[vision.worker] model not found at ${url} (HTTP ${res.status}). ` +
          `Place face-api weights in public/models/ — see public/models/models-info.txt.`,
      );
    }
  }
}

async function init(modelUrl: string) {
  if (initialized) return;
  // eslint-disable-next-line no-console
  console.info('[vision.worker] init — verifying model URLs at', modelUrl);
  try {
    await preflight(modelUrl);
    await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
    await faceapi.nets.faceExpressionNet.loadFromUri(modelUrl);
    initialized = true;
    // eslint-disable-next-line no-console
    console.info('[vision.worker] ready — face-api models loaded');
    post({ type: 'ready' });
  } catch (err) {
    const message = (err as Error).message || String(err);
    // eslint-disable-next-line no-console
    console.error('[vision.worker] init failed:', message);
    post({ type: 'error', message, code: 'MODEL_LOAD_FAILED' });
  }
}

async function processFrame(bitmap: ImageBitmap, ts: number) {
  if (!initialized || busy) {
    bitmap.close();
    return;
  }
  busy = true;
  try {
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
      post({ type: 'emotion', ts, emotion: top, confidence: best, expressions: e });
    }
  } catch (err) {
    post({ type: 'error', message: (err as Error).message, code: 'INFERENCE_FAILED' });
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

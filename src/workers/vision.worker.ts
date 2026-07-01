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
  | { type: 'init'; modelUrl: string; traceparent?: string }
  | { type: 'frame'; bitmap: ImageBitmap; ts: number; traceparent?: string }
  | { type: 'dispose' };

type OutboundMessage =
  | { type: 'ready'; traceparent?: string }
  | { type: 'error'; message: string; code?: string; traceparent?: string }
  | {
      type: 'emotion';
      ts: number;
      emotion: string;
      confidence: number;
      expressions: Record<string, number>;
      /** W3C traceparent echoed from the originating `frame` message so the
       *  end-to-end span (frame → preflight → inference → emotion) joins
       *  the API/WebSocket trace tree in Grafana/Tempo. */
      traceparent?: string;
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

async function init(modelUrl: string, traceparent?: string) {
  if (initialized) { post({ type: 'ready', traceparent }); return; }
  console.info('[vision.worker] init — verifying model URLs at', modelUrl,
    traceparent ? `(traceparent=${traceparent})` : '');
  try {
    await preflight(modelUrl);
    await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
    await faceapi.nets.faceExpressionNet.loadFromUri(modelUrl);
    initialized = true;
    console.info('[vision.worker] ready — face-api models loaded');
    post({ type: 'ready', traceparent });
  } catch (err) {
    const message = (err as Error).message || String(err);
    console.error('[vision.worker] init failed:', message);
    post({ type: 'error', message, code: 'MODEL_LOAD_FAILED', traceparent });
  }
}

async function processFrame(bitmap: ImageBitmap, ts: number, traceparent?: string) {
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
        // inputSize 320 balances latency (~35ms on M-class CPUs) with
        // recall; scoreThreshold 0.35 catches partial / side-lit faces
        // that the previous 0.5 cutoff was silently dropping.
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }),
      )
      .withFaceExpressions();

    if (detections.length > 0) {
      const e = detections[0].expressions as unknown as Record<string, number>;
      let top = 'neutral';
      let best = 0;
      for (const [k, v] of Object.entries(e)) {
        if (v > best) { best = v; top = k; }
      }
      // Echo traceparent so the main thread can stitch frame→inference→emotion
      // into the same end-to-end span exported via OTLP.
      post({ type: 'emotion', ts, emotion: top, confidence: best, expressions: e, traceparent });
    }
  } catch (err) {
    post({ type: 'error', message: (err as Error).message, code: 'INFERENCE_FAILED', traceparent });
  } finally {
    bitmap.close();
    busy = false;
  }
}

ctx.onmessage = (ev: MessageEvent<InboundMessage>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'init':
      void init(msg.modelUrl, msg.traceparent);
      break;
    case 'frame':
      void processFrame(msg.bitmap, msg.ts, msg.traceparent);
      break;
    case 'dispose':
      initialized = false;

      break;
  }
};

export {};

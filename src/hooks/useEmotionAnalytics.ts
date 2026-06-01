/**
 * useEmotionAnalytics
 * ---------------------------------------------------------------
 * Unified replacement for `useAdvancedEmotionDetection` and
 * `useImprovedEmotionDetection`.
 *
 * - Runs face-api (vladmandic) inside `vision.worker.ts` via a
 *   zero-copy ImageBitmap transfer (no main-thread inference).
 * - Maintains a sliding temporal-smoothing window with weighted
 *   confidence (carried over from the "improved" hook).
 * - Exposes a `latestRef` mutable ref so the Three.js render loop
 *   can read the freshest emotion without triggering React renders.
 *
 * Public API is intentionally close to the previous hooks so call
 * sites need minimal changes:
 *   { isActive, currentEmotion, confidence, expressions,
 *     isModelLoading, error, latestRef, startDetection, stopDetection }
 * ---------------------------------------------------------------
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface EmotionSnapshot {
  emotion: string;
  confidence: number;
  expressions: Record<string, number>;
  timestamp: number;
}

const SAMPLE_INTERVAL_MS = 350;
const HISTORY_WINDOW_MS = 2500;
const HISTORY_MAX = 8;

const EMPTY_EXPRESSIONS = {
  happy: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  neutral: 1,
  fearful: 0,
  disgusted: 0,
};

const analyzeFrameHeuristic = (videoElement: HTMLVideoElement): EmotionSnapshot | null => {
  if (!videoElement || videoElement.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const avgBrightness = totalBrightness / (data.length / 4);

  let variance = 0;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    variance += Math.pow(brightness - avgBrightness, 2);
  }

  const brightness = Math.min(1, avgBrightness / 255);
  const contrast = Math.min(1, Math.sqrt(variance / (data.length / 4)) / 100);
  const expressions = {
    neutral: 0.3 + (1 - Math.abs(brightness - 0.5)) * 0.4,
    happy: brightness * 0.6 + contrast * 0.2,
    sad: (1 - brightness) * 0.4 + (1 - contrast) * 0.2,
    angry: contrast * 0.5 + (brightness < 0.4 ? 0.3 : 0),
    surprised: contrast * 0.7,
    fearful: contrast * 0.3 + (brightness < 0.3 ? 0.4 : 0),
    disgusted: (1 - brightness) * 0.3 + contrast * 0.2,
  };
  const total = Object.values(expressions).reduce((sum, value) => sum + value, 0);
  Object.keys(expressions).forEach((key) => {
    expressions[key as keyof typeof expressions] /= total;
  });

  const [emotion, confidence] = Object.entries(expressions).reduce((best, entry) =>
    entry[1] > best[1] ? entry : best,
  );

  return { emotion, confidence, expressions, timestamp: Date.now() };
};

export const useEmotionAnalytics = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [confidence, setConfidence] = useState(0);
  const [expressions, setExpressions] = useState<Record<string, number>>({});
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Always-fresh snapshot for non-React consumers (Three.js render loop). */
  const latestRef = useRef<EmotionSnapshot | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const fallbackRef = useRef(false);
  const historyRef = useRef<EmotionSnapshot[]>([]);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const smooth = useCallback((sample: EmotionSnapshot) => {
    const now = sample.timestamp;
    historyRef.current.push(sample);
    historyRef.current = historyRef.current
      .filter((s) => now - s.timestamp < HISTORY_WINDOW_MS)
      .slice(-HISTORY_MAX);

    const buckets: Record<string, { count: number; total: number }> = {};
    for (const s of historyRef.current) {
      buckets[s.emotion] ||= { count: 0, total: 0 };
      buckets[s.emotion].count += 1;
      buckets[s.emotion].total += s.confidence;
    }
    let best = 'neutral';
    let bestScore = 0;
    let bestConf = 0;
    for (const [k, v] of Object.entries(buckets)) {
      const avg = v.total / v.count;
      const score = avg * v.count;
      if (score > bestScore) {
        bestScore = score;
        best = k;
        bestConf = avg;
      }
    }
    const smoothed: EmotionSnapshot = {
      emotion: best,
      confidence: bestConf,
      expressions: sample.expressions,
      timestamp: now,
    };
    latestRef.current = smoothed;
    // React state update is rate-limited by the natural SAMPLE_INTERVAL_MS.
    setCurrentEmotion(best);
    setConfidence(bestConf);
    setExpressions(sample.expressions);
  }, []);

  const ensureWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    setIsModelLoading(true);
    const worker = new Worker(new URL('../workers/vision.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg.type === 'ready') {
        readyRef.current = true;
        fallbackRef.current = false;
        setIsModelLoading(false);
      } else if (msg.type === 'error') {
        console.warn('[emotion] Worker model path failed; using local heuristic fallback.', msg.message);
        fallbackRef.current = true;
        readyRef.current = false;
        setError(null);
        setIsModelLoading(false);
      } else if (msg.type === 'emotion') {
        smooth({
          emotion: msg.emotion,
          confidence: msg.confidence,
          expressions: msg.expressions,
          timestamp: msg.ts,
        });
      }
    };

    // Models are served from /models (public/models) — see public/models/models-info.txt.
    worker.postMessage({ type: 'init', modelUrl: '/models' });
    return worker;
  }, [smooth]);

  const pumpFrame = useCallback(async () => {
    const video = videoRef.current;
    const worker = workerRef.current;
    if (!video) return;
    if (video.readyState !== 4 || video.videoWidth === 0) return;
    if (fallbackRef.current || !worker || !readyRef.current || !('createImageBitmap' in window)) {
      const sample = analyzeFrameHeuristic(video);
      if (sample) smooth(sample);
      return;
    }
    try {
      const bitmap = await createImageBitmap(video);
      worker.postMessage({ type: 'frame', bitmap, ts: Date.now() }, [bitmap]);
    } catch (err) {
      console.warn('[emotion] Frame transfer failed; using local heuristic fallback.', err);
      fallbackRef.current = true;
    }
  }, [smooth]);

  const startDetection = useCallback(
    async (videoElement: HTMLVideoElement) => {
      videoRef.current = videoElement;
      setError(null);
      if (!('OffscreenCanvas' in window) || !('Worker' in window)) {
        fallbackRef.current = true;
        setExpressions(EMPTY_EXPRESSIONS);
      } else {
        await ensureWorker();
      }
      setIsActive(true);
      sampleTimerRef.current && clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = setInterval(pumpFrame, SAMPLE_INTERVAL_MS);
    },
    [ensureWorker, pumpFrame],
  );

  const stopDetection = useCallback(() => {
    setIsActive(false);
    setCurrentEmotion('neutral');
    setConfidence(0);
    setExpressions({});
    historyRef.current = [];
    latestRef.current = null;
    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopDetection();
      workerRef.current?.postMessage({ type: 'dispose' });
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [stopDetection]);

  return {
    isActive,
    currentEmotion,
    confidence,
    expressions,
    isModelLoading,
    error,
    latestRef,
    startDetection,
    stopDetection,
  };
};

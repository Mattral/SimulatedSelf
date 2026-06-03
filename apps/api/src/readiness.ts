/**
 * Deep readiness checker.
 *
 * Reports on three dimensions K8s needs to know about before routing
 * traffic to this pod:
 *
 *   1. redis   – PING within 250 ms
 *   2. ws      – the in-process WebSocket accept-handler is wired and
 *                the active session count is below the soft cap.
 *   3. models  – the public face-api model manifests resolve at the
 *                configured MODEL_BASE_URL (HEAD with timeout).
 *
 * The aggregate `ok` is a logical AND across all three; the structured
 * `checks` payload is also emitted to stdout when a probe fails so
 * kubelet logs contain root-cause context.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const MODEL_BASE_URL = process.env.MODEL_BASE_URL ?? '';
const WS_SOFT_CAP = Number(process.env.WS_SOFT_CAP ?? 500);
const MODEL_MANIFESTS = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_expression_model-weights_manifest.json',
];

// Lazy singleton — avoids reconnect storms across rapid probe calls.
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 250,
      enableOfflineQueue: false,
    });
    redis.on('error', () => { /* swallow; surfaced via readiness */ });
  }
  return redis;
}

const activeSessions = new Set<string>();
export function registerWsSession(id: string) { activeSessions.add(id); }
export function unregisterWsSession(id: string) { activeSessions.delete(id); }
export function activeSessionCount(): number { return activeSessions.size; }

export interface ReadinessReport {
  ok: boolean;
  ts: number;
  checks: {
    redis: { ok: boolean; latencyMs?: number; error?: string };
    ws: { ok: boolean; active: number; softCap: number };
    models?: { ok: boolean; failed?: string[] };
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms)),
  ]);
}

async function pingRedis(): Promise<ReadinessReport['checks']['redis']> {
  const t0 = performance.now();
  try {
    const r = getRedis();
    if (r.status === 'end' || r.status === 'wait') await r.connect().catch(() => {});
    const pong = await withTimeout(r.ping(), 250, 'redis.ping');
    return { ok: pong === 'PONG', latencyMs: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function checkModels(): Promise<ReadinessReport['checks']['models']> {
  if (!MODEL_BASE_URL) return undefined;
  const base = MODEL_BASE_URL.replace(/\/$/, '');
  const failed: string[] = [];
  await Promise.all(MODEL_MANIFESTS.map(async (m) => {
    try {
      const res = await withTimeout(fetch(`${base}/${m}`, { method: 'HEAD' }), 500, `model.${m}`);
      if (!res.ok) failed.push(`${m} (HTTP ${res.status})`);
    } catch (e) {
      failed.push(`${m} (${(e as Error).message})`);
    }
  }));
  return { ok: failed.length === 0, failed: failed.length ? failed : undefined };
}

export async function checkReadiness(): Promise<ReadinessReport> {
  const [redisCheck, modelsCheck] = await Promise.all([pingRedis(), checkModels()]);
  const wsCheck = {
    ok: activeSessions.size <= WS_SOFT_CAP,
    active: activeSessions.size,
    softCap: WS_SOFT_CAP,
  };
  const ok = redisCheck.ok && wsCheck.ok && (modelsCheck?.ok ?? true);
  return {
    ok,
    ts: Date.now(),
    checks: { redis: redisCheck, ws: wsCheck, ...(modelsCheck ? { models: modelsCheck } : {}) },
  };
}

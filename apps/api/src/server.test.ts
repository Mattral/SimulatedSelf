/**
 * Black-box API contract tests for the backend gateway.
 *
 * Boots the in-process Bun server, then drives /healthz, /readyz and
 * /diagnostics/vision over real HTTP. Redis is allowed to be down —
 * the test asserts that /readyz reports the failure structurally
 * rather than crashing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

let baseUrl: string;
let serverProcess: { kill(): void } | null = null;

beforeAll(async () => {
  const port = 18181 + Math.floor(Math.random() * 1000);
  baseUrl = `http://127.0.0.1:${port}`;
  const proc = Bun.spawn(['bun', 'apps/api/src/server.ts'], {
    env: { ...process.env, PORT: String(port), REDIS_URL: 'redis://127.0.0.1:1' },
    stdout: 'ignore',
    stderr: 'ignore',
  });
  serverProcess = { kill: () => proc.kill() };
  // Wait for liveness.
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${baseUrl}/healthz`);
      if (r.ok) { await r.text(); return; }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('api did not become live');
});

afterAll(() => serverProcess?.kill());

describe('GET /healthz', () => {
  it('returns 200 with a timestamp', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe('number');
  });
});

describe('GET /readyz', () => {
  it('returns 503 with structured per-dependency status when Redis is down', async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.checks.redis.ok).toBe(false);
    expect(body.checks.ws.ok).toBe(true);
    expect(typeof body.checks.ws.active).toBe('number');
  });
});

describe('GET /diagnostics/vision', () => {
  it('returns per-model status entries', async () => {
    const res = await fetch(`${baseUrl}/diagnostics/vision?modelBaseUrl=https://invalid.example/models`);
    const body = await res.json();
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.length).toBe(2);
    expect(body.ok).toBe(false);
  });
});

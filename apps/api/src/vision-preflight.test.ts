/**
 * Backend vision-diagnostics preflight tests.
 * Uses a mocked fetch to assert per-model status accounting.
 */
import { describe, it, expect } from 'bun:test';
import { runVisionPreflight } from './vision-preflight';

function mockFetch(map: Record<string, { status: number; ok?: boolean }>) {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const hit = Object.entries(map).find(([suffix]) => url.endsWith(suffix));
    if (!hit) throw new Error(`unmocked ${url}`);
    const { status, ok } = hit[1];
    return new Response('{}', { status }) as Response & { ok: boolean };
  }) as unknown as typeof fetch;
}

describe('runVisionPreflight', () => {
  it('returns ok=true when every manifest resolves with 200', async () => {
    const res = await runVisionPreflight('https://cdn.example/models', mockFetch({
      'tiny_face_detector_model-weights_manifest.json': { status: 200 },
      'face_expression_model-weights_manifest.json': { status: 200 },
    }));
    expect(res.ok).toBe(true);
    expect(res.models).toHaveLength(2);
    expect(res.models.every((m) => m.ok)).toBe(true);
    expect(res.message).toMatch(/passed/);
  });

  it('returns ok=false and identifies the failing manifest on 404', async () => {
    const res = await runVisionPreflight('https://cdn.example/models/', mockFetch({
      'tiny_face_detector_model-weights_manifest.json': { status: 200 },
      'face_expression_model-weights_manifest.json': { status: 404 },
    }));
    expect(res.ok).toBe(false);
    const failed = res.models.find((m) => !m.ok);
    expect(failed?.file).toBe('face_expression_model-weights_manifest.json');
    expect(failed?.status).toBe(404);
  });

  it('captures network errors per model without throwing', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    const res = await runVisionPreflight('https://cdn.example/models', fetchImpl);
    expect(res.ok).toBe(false);
    expect(res.models[0].error).toBe('ECONNRESET');
  });

  it('strips trailing slash from modelBaseUrl', async () => {
    const res = await runVisionPreflight('https://cdn.example/models/', mockFetch({
      'tiny_face_detector_model-weights_manifest.json': { status: 200 },
      'face_expression_model-weights_manifest.json': { status: 200 },
    }));
    expect(res.modelBaseUrl).toBe('https://cdn.example/models');
  });
});

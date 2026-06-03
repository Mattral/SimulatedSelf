/**
 * Vision-worker model preflight (server side).
 *
 * Mirrors the client-side check performed inside
 * `src/workers/vision.worker.ts` so operators can hit a backend URL
 * (`/diagnostics/vision`) without spinning up a browser. The Supabase
 * edge function `vision-diagnostics` calls this same logic shape.
 */
const MANIFESTS = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_expression_model-weights_manifest.json',
];

export interface ModelCheck {
  file: string;
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface VisionPreflightResult {
  ok: boolean;
  modelBaseUrl: string;
  worker: string;
  models: ModelCheck[];
  message: string;
}

export async function runVisionPreflight(
  modelBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VisionPreflightResult> {
  const base = modelBaseUrl.replace(/\/$/, '');
  const models = await Promise.all(MANIFESTS.map(async (file): Promise<ModelCheck> => {
    const url = `${base}/${file}`;
    try {
      const res = await fetchImpl(url, { method: 'GET', cache: 'no-store' });
      return { file, url, ok: res.ok, status: res.status };
    } catch (e) {
      return { file, url, ok: false, error: (e as Error).message };
    }
  }));
  const ok = models.every((m) => m.ok);
  return {
    ok,
    modelBaseUrl: base,
    worker: 'src/workers/vision.worker.ts',
    models,
    message: ok
      ? 'Vision worker model preflight passed.'
      : 'Vision worker model preflight failed. Verify /models assets and CDN permissions.',
  };
}

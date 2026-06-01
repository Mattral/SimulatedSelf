const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const manifests = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_expression_model-weights_manifest.json',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const origin = url.searchParams.get('origin') ?? req.headers.get('origin') ?? '';
  const modelBaseUrl = (url.searchParams.get('modelBaseUrl') ?? `${origin}/models`).replace(/\/$/, '');

  const checks = await Promise.all(manifests.map(async (manifest) => {
    const target = `${modelBaseUrl}/${manifest}`;
    try {
      const response = await fetch(target, { method: 'GET', cache: 'no-store' });
      return { file: manifest, url: target, ok: response.ok, status: response.status };
    } catch (error) {
      return { file: manifest, url: target, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }));

  const ok = Boolean(origin || url.searchParams.get('modelBaseUrl')) && checks.every((check) => check.ok);
  return new Response(JSON.stringify({
    ok,
    worker: 'src/workers/vision.worker.ts',
    modelBaseUrl,
    models: checks,
    message: ok
      ? 'Vision worker model preflight passed.'
      : 'Vision worker model preflight failed. Verify the deployed /models assets and permissions.',
  }), {
    status: ok ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
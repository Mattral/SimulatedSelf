const modelDir = `${process.cwd()}/public/models`;
const manifests = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_expression_model-weights_manifest.json',
];

for (const manifest of manifests) {
  const path = `${modelDir}/${manifest}`;
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`[vision-smoke] missing ${path}`);
  const json = await file.json();
  const weights = json?.[0]?.weightsManifest?.[0]?.paths ?? json?.weightsManifest?.[0]?.paths ?? [];
  for (const weight of weights) {
    const weightPath = `${modelDir}/${weight}`;
    if (!(await Bun.file(weightPath).exists())) throw new Error(`[vision-smoke] missing ${weightPath}`);
  }
}

const result = await Bun.build({
  entrypoints: ['./src/workers/vision.worker.ts'],
  target: 'browser',
  format: 'esm',
  write: false,
});

if (!result.success) {
  for (const log of result.logs) console.error(log.message);
  throw new Error('[vision-smoke] worker failed to bundle');
}

console.log('[vision-smoke] worker bundles and required model URLs resolve.');
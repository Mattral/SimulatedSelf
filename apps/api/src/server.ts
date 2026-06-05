/**
 * Simulated-Self API Gateway
 * ------------------------------------------------------------------
 * Probe + diagnostics contract:
 *   GET /healthz              liveness   (always 200 when alive)
 *   GET /readyz               readiness  (deep checks; 200/503)
 *   GET /diagnostics/vision   model URL preflight
 *   GET /metrics              Prometheus exposition
 *   GET /openapi.json         OpenAPI 3.1 spec
 *   GET /docs                 Swagger UI
 *   WS  /api/ws               session fan-out
 * ------------------------------------------------------------------
 */
import { checkReadiness, registerWsSession, unregisterWsSession, activeSessionCount } from './readiness';
import { runVisionPreflight } from './vision-preflight';
import { recordModelPreflight, renderMetrics, setWsActive, incWsTotal } from './metrics';
import { openapiSpec, swaggerHtml } from './openapi';

const PORT = Number(process.env.PORT ?? 8081);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);

    if (url.pathname === '/healthz') return json({ ok: true, ts: Date.now() });

    if (url.pathname === '/readyz') {
      const report = await checkReadiness();
      if (!report.ok) console.error('[readyz] NOT READY', JSON.stringify(report));
      return json(report, report.ok ? 200 : 503);
    }

    if (url.pathname === '/diagnostics/vision') {
      const modelBaseUrl = url.searchParams.get('modelBaseUrl') ?? `${url.origin}/models`;
      const t0 = performance.now();
      const result = await runVisionPreflight(modelBaseUrl);
      recordModelPreflight(performance.now() - t0, result.ok);
      return json(result, result.ok ? 200 : 503);
    }

    if (url.pathname === '/metrics') {
      setWsActive(activeSessionCount());
      return new Response(renderMetrics(), {
        status: 200,
        headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
      });
    }

    if (url.pathname === '/openapi.json') return json(openapiSpec);
    if (url.pathname === '/docs' || url.pathname === '/docs/') {
      return new Response(swaggerHtml, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/api/ws') {
      const upgraded = srv.upgrade(req, { data: { id: crypto.randomUUID() } });
      if (upgraded) return undefined as unknown as Response;
      return new Response('upgrade failed', { status: 400 });
    }

    return new Response('not found', { status: 404 });
  },
  websocket: {
    open(ws) {
      const id = (ws.data as { id: string }).id;
      registerWsSession(id);
      incWsTotal();
      setWsActive(activeSessionCount());
    },
    message(ws, msg) {
      ws.send(typeof msg === 'string' ? msg : new Uint8Array(msg as ArrayBuffer));
    },
    close(ws) {
      unregisterWsSession((ws.data as { id: string }).id);
      setWsActive(activeSessionCount());
    },
  },
});

console.info(`[api] listening on :${server.port}`);

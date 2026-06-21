/**
 * Simulated-Self API Gateway
 * ------------------------------------------------------------------
 * Probe + diagnostics contract:
 *   GET /healthz              liveness   (always 200 when alive)
 *   GET /readyz               readiness  (deep checks; 200/503)
 *   GET /drain                preStop hook — flips readiness off + drains WS
 *   GET /diagnostics/vision   model URL preflight
 *   GET /metrics              Prometheus exposition
 *   GET /openapi.json         OpenAPI 3.1 spec
 *   GET /docs                 Swagger UI
 *   WS  /api/ws               session fan-out
 *
 * Cross-cutting:
 *   • OpenTelemetry — every request gets a span; traceparent is propagated
 *     to WebSocket sessions and recorded as session-level span attributes.
 *   • Correlation IDs — `x-request-id` (UUID) is injected/echoed and the
 *     active traceId is mirrored as `x-trace-id` on every response so the
 *     SPA can attach it to error reports.
 *   • Graceful shutdown — SIGTERM flips readiness off, sends a `{type:"drain"}`
 *     frame to every WS client (so clients can reconnect to a healthy pod),
 *     then closes the listener after the grace window.
 * ------------------------------------------------------------------
 */
import { checkReadiness, registerWsSession, unregisterWsSession, activeSessionCount, type ReadinessReport } from './readiness';
import { runVisionPreflight } from './vision-preflight';
import { recordModelPreflight, renderMetrics, setWsActive, incWsTotal, recordHttpRequest } from './metrics';
import { openapiSpec, swaggerHtml } from './openapi';
import { startTracing, withSpan, extractContext, currentTraceId, context as otelContext } from './tracing';

startTracing();

const PORT = Number(process.env.PORT ?? 8081);
const DRAIN_GRACE_MS = Number(process.env.DRAIN_GRACE_MS ?? 15_000);

/** Process-wide drain flag. Once set, /readyz returns 503 and WS upgrades 503. */
let draining = false;
const activeSockets = new Set<{ ws: any; id: string }>();

function withCorrelation(res: Response, requestId: string): Response {
  const h = new Headers(res.headers);
  h.set('x-request-id', requestId);
  const tid = currentTraceId();
  if (tid) h.set('x-trace-id', tid);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

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
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
    const ctx = extractContext(req.headers);

    return await otelContext.with(ctx, async () => {
      const t0 = performance.now();
      const route = url.pathname;
      let status = 500;
      try {
        const res = await withSpan(`HTTP ${req.method} ${route}`, async (span) => {
          span.setAttribute('http.method', req.method);
          span.setAttribute('http.route', route);
          span.setAttribute('http.request_id', requestId);

          if (route === '/healthz') return json({ ok: true, ts: Date.now() });

          if (route === '/readyz') {
            const report: ReadinessReport = await checkReadiness();
            const ok = report.ok && !draining;
            if (!ok) console.error('[readyz] NOT READY', JSON.stringify({ requestId, draining, report }));
            return json({ ...report, draining }, ok ? 200 : 503);
          }

          if (route === '/drain') {
            // preStop hook target. Idempotent.
            if (!draining) {
              draining = true;
              console.warn('[drain] preStop received — broadcasting drain to', activeSockets.size, 'sockets');
              for (const s of activeSockets) {
                try { s.ws.send(JSON.stringify({ type: 'drain', reason: 'pod-shutdown' })); } catch { /* ignore */ }
              }
            }
            return json({ ok: true, draining: true, active: activeSockets.size });
          }

          if (route === '/diagnostics/vision') {
            const modelBaseUrl = url.searchParams.get('modelBaseUrl') ?? `${url.origin}/models`;
            const tp = performance.now();
            const result = await runVisionPreflight(modelBaseUrl);
            recordModelPreflight(performance.now() - tp, result.ok);
            return json(result, result.ok ? 200 : 503);
          }

          if (route === '/metrics') {
            setWsActive(activeSessionCount());
            return new Response(renderMetrics(), {
              status: 200,
              headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
            });
          }

          if (route === '/openapi.json') return json(openapiSpec);
          if (route === '/docs' || route === '/docs/') {
            return new Response(swaggerHtml, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
          }

          if (route === '/api/ws') {
            if (draining) return new Response('draining', { status: 503 });
            const upgraded = srv.upgrade(req, {
              data: { id: crypto.randomUUID(), traceparent: req.headers.get('traceparent') ?? '' },
            });
            if (upgraded) return undefined as unknown as Response;
            return new Response('upgrade failed', { status: 400 });
          }

          return new Response('not found', { status: 404 });
        });

        status = res?.status ?? 200;
        return withCorrelation(res ?? new Response(null, { status: 101 }), requestId);
      } finally {
        recordHttpRequest(route, status, performance.now() - t0);
      }
    });
  },
  websocket: {
    open(ws) {
      const { id, traceparent } = ws.data as { id: string; traceparent: string };
      registerWsSession(id);
      activeSockets.add({ ws, id });
      incWsTotal();
      setWsActive(activeSessionCount());
      // Record session span (fire-and-forget); attaches to parent traceparent if present.
      const ctx = extractContext(new Headers(traceparent ? { traceparent } : {}));
      otelContext.with(ctx, () => {
        withSpan('ws.session', async () => { /* span closes on ws.close */ }, { 'ws.session_id': id });
      });
    },
    message(ws, msg) {
      ws.send(typeof msg === 'string' ? msg : new Uint8Array(msg as ArrayBuffer));
    },
    close(ws) {
      const { id } = ws.data as { id: string };
      unregisterWsSession(id);
      for (const s of activeSockets) if (s.id === id) activeSockets.delete(s);
      setWsActive(activeSessionCount());
    },
  },
});

console.info(`[api] listening on :${server.port}`);

// -------- Graceful shutdown --------
async function shutdown(signal: string) {
  console.warn(`[shutdown] ${signal} received — entering drain`);
  draining = true;
  for (const s of activeSockets) {
    try { s.ws.send(JSON.stringify({ type: 'drain', reason: signal })); } catch { /* ignore */ }
  }
  // Give clients a chance to reconnect to a healthy pod.
  await new Promise((r) => setTimeout(r, DRAIN_GRACE_MS));
  for (const s of activeSockets) { try { s.ws.close(1001, 'shutdown'); } catch { /* ignore */ } }
  server.stop();
  console.warn('[shutdown] complete');
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

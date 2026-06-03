/**
 * Simulated-Self API Gateway
 * ------------------------------------------------------------------
 * Responsibilities
 *   - WebSocket session fan-out for human-robot interaction frames
 *   - Redis-backed session context cache (active conversation state)
 *   - Health + deep readiness diagnostics for Kubernetes probes
 *   - Vision-worker model preflight passthrough (/diagnostics/vision)
 *
 * Probe contract
 *   GET /healthz  -> 200 always-on liveness signal (process is alive)
 *   GET /readyz   -> 200 only when Redis is reachable AND the WS
 *                    subsystem is accepting upgrades. Returns a
 *                    structured JSON body so the probe failure logs
 *                    surface root cause (Redis vs WS vs model URLs).
 * ------------------------------------------------------------------
 */
import { checkReadiness, registerWsSession, unregisterWsSession } from './readiness';
import { runVisionPreflight } from './vision-preflight';

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

    // --- Liveness --------------------------------------------------
    if (url.pathname === '/healthz') return json({ ok: true, ts: Date.now() });

    // --- Deep readiness -------------------------------------------
    if (url.pathname === '/readyz') {
      const report = await checkReadiness();
      if (!report.ok) {
        // Structured log so kubelet probe failures land in stdout with
        // enough context to triage Redis vs WS vs model URL issues.
        console.error('[readyz] NOT READY', JSON.stringify(report));
      }
      return json(report, report.ok ? 200 : 503);
    }

    // --- Vision diagnostics passthrough (mirrors the edge function) -
    if (url.pathname === '/diagnostics/vision') {
      const modelBaseUrl =
        url.searchParams.get('modelBaseUrl') ??
        `${url.origin}/models`;
      const result = await runVisionPreflight(modelBaseUrl);
      return json(result, result.ok ? 200 : 503);
    }

    // --- WebSocket upgrade ----------------------------------------
    if (url.pathname === '/api/ws') {
      const upgraded = srv.upgrade(req, { data: { id: crypto.randomUUID() } });
      if (upgraded) return undefined as unknown as Response;
      return new Response('upgrade failed', { status: 400 });
    }

    return new Response('not found', { status: 404 });
  },
  websocket: {
    open(ws) {
      registerWsSession((ws.data as { id: string }).id);
    },
    message(ws, msg) {
      // Echo for now; real impl forwards to LLM/orchestration pipeline.
      ws.send(typeof msg === 'string' ? msg : new Uint8Array(msg as ArrayBuffer));
    },
    close(ws) {
      unregisterWsSession((ws.data as { id: string }).id);
    },
  },
});

console.info(`[api] listening on :${server.port}`);

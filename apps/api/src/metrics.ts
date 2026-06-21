/**
 * Prometheus metrics — zero-dependency text exposition format.
 *
 * We intentionally avoid `prom-client` to keep the API image lean and
 * the cold-start fast. The format is stable and trivially correct for
 * the small surface area we expose:
 *
 *   redis_ping_latency_ms        (histogram, ms)
 *   model_preflight_duration_ms  (histogram, ms, labels: result)
 *   vision_preflight_failures_total (counter)
 *   websocket_active_connections (gauge)
 *   websocket_sessions_total     (counter)
 *
 * See https://prometheus.io/docs/instrumenting/exposition_formats/
 */

type Histogram = { buckets: number[]; counts: number[]; sum: number; count: number };

const LATENCY_BUCKETS_MS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

function newHist(): Histogram {
  return { buckets: LATENCY_BUCKETS_MS, counts: new Array(LATENCY_BUCKETS_MS.length).fill(0), sum: 0, count: 0 };
}

function observe(h: Histogram, valueMs: number) {
  h.sum += valueMs;
  h.count += 1;
  for (let i = 0; i < h.buckets.length; i++) {
    if (valueMs <= h.buckets[i]) h.counts[i] += 1;
  }
}

const redisPing = newHist();
const modelPreflight: Record<string, Histogram> = { ok: newHist(), fail: newHist() };
let visionFailures = 0;
let wsActive = 0;
let wsTotal = 0;

// http_requests_total{route,status} — drives SLO availability burn-rate rules.
const httpRequests = new Map<string, number>();
const httpDuration = newHist();

export function recordRedisPing(ms: number) { observe(redisPing, ms); }
export function recordModelPreflight(ms: number, ok: boolean) {
  observe(modelPreflight[ok ? 'ok' : 'fail'], ms);
  if (!ok) visionFailures += 1;
}
export function setWsActive(n: number) { wsActive = n; }
export function incWsTotal() { wsTotal += 1; }
export function recordHttpRequest(route: string, status: number, durationMs: number) {
  const key = `${route}|${status}`;
  httpRequests.set(key, (httpRequests.get(key) ?? 0) + 1);
  observe(httpDuration, durationMs);
}

function renderHistogram(name: string, help: string, h: Histogram, labels = ''): string {
  const lp = labels ? `,${labels}` : '';
  const lOnly = labels ? `{${labels}}` : '';
  const lines = [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} histogram`,
  ];
  let cumulative = 0;
  for (let i = 0; i < h.buckets.length; i++) {
    cumulative = h.counts[i]; // counts already cumulative-per-bucket via observe()
    lines.push(`${name}_bucket{le="${h.buckets[i]}"${lp}} ${cumulative}`);
  }
  lines.push(`${name}_bucket{le="+Inf"${lp}} ${h.count}`);
  lines.push(`${name}_sum${lOnly} ${h.sum}`);
  lines.push(`${name}_count${lOnly} ${h.count}`);
  return lines.join('\n');
}

export function renderMetrics(): string {
  const out: string[] = [];
  out.push(renderHistogram('redis_ping_latency_ms', 'Redis PING round-trip latency in ms.', redisPing));
  out.push(renderHistogram('model_preflight_duration_ms', 'Vision model preflight duration in ms.', modelPreflight.ok, 'result="ok"'));
  out.push(renderHistogram('model_preflight_duration_ms', 'Vision model preflight duration in ms.', modelPreflight.fail, 'result="fail"'));
  out.push(
    '# HELP vision_preflight_failures_total Total failed vision preflight runs.',
    '# TYPE vision_preflight_failures_total counter',
    `vision_preflight_failures_total ${visionFailures}`,
  );
  out.push(
    '# HELP websocket_active_connections Currently open WebSocket sessions.',
    '# TYPE websocket_active_connections gauge',
    `websocket_active_connections ${wsActive}`,
  );
  out.push(
    '# HELP websocket_sessions_total Cumulative WebSocket sessions accepted.',
    '# TYPE websocket_sessions_total counter',
    `websocket_sessions_total ${wsTotal}`,
  );
  return out.join('\n') + '\n';
}

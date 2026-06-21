/**
 * Browser-side telemetry shim.
 *
 * Keeps a per-tab `sessionTraceId` and generates per-request `x-request-id`
 * values so client logs, the API gateway, and the OTel collector can be
 * joined on a single correlation key without pulling the full
 * `@opentelemetry/sdk-trace-web` bundle into the SPA.
 *
 * When OTLP is desired in production we send a `traceparent` header in
 * W3C format using random ids — the API gateway will receive it via
 * `extractContext` and continue the trace server-side.
 */

const HEX = '0123456789abcdef';
function randHex(n: number): string {
  let out = '';
  const buf = new Uint8Array(n / 2);
  crypto.getRandomValues(buf);
  for (let i = 0; i < buf.length; i++) {
    out += HEX[buf[i] >> 4] + HEX[buf[i] & 0xf];
  }
  return out;
}

const sessionTraceId = randHex(32); // 16 bytes / 32 hex chars

export function newSpanId(): string { return randHex(16); }
export function getSessionTraceId(): string { return sessionTraceId; }
export function newRequestId(): string { return crypto.randomUUID(); }

/** Build a W3C traceparent header value tied to this tab's trace. */
export function traceparent(spanId = newSpanId()): string {
  return `00-${sessionTraceId}-${spanId}-01`;
}

/** Wrap fetch with correlation headers; returns the same Response. */
export async function tracedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('traceparent')) headers.set('traceparent', traceparent());
  if (!headers.has('x-request-id')) headers.set('x-request-id', newRequestId());
  return await fetch(input, { ...init, headers });
}

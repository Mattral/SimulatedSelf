/**
 * OpenTelemetry initialisation for the API gateway.
 *
 * Exports OTLP/HTTP to a Collector (env: OTEL_EXPORTER_OTLP_ENDPOINT, default
 * http://otel-collector.observability.svc.cluster.local:4318). Resource
 * attributes follow the Resource Semantic Conventions so traces can be
 * correlated with k8s pods in Tempo/Jaeger/Honeycomb.
 *
 * Correlation IDs:
 *   - Every inbound HTTP request gets a `x-request-id` (generated if absent).
 *   - The current span's traceId is mirrored in the response as `x-trace-id`
 *     so the frontend can attach it to error reports.
 *   - WebSocket sessions extract `traceparent` from the upgrade request and
 *     start a span per session that wraps all message-handler spans.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  SemanticResourceAttributes as SRA,
} from '@opentelemetry/semantic-conventions';
import { trace, context, propagation, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'simself-api';
const ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
  'http://otel-collector.observability.svc.cluster.local:4318';

let started = false;
let tracerRef: Tracer | null = null;

export function startTracing(): Tracer {
  if (started) return tracerRef!;
  started = true;

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const sdk = new NodeSDK({
    resource: new Resource({
      [SRA.SERVICE_NAME]: SERVICE_NAME,
      [SRA.SERVICE_VERSION]: process.env.GIT_SHA ?? 'dev',
      [SRA.DEPLOYMENT_ENVIRONMENT]: process.env.DEPLOY_ENV ?? 'dev',
      [SRA.K8S_POD_NAME]: process.env.HOSTNAME ?? 'local',
      [SRA.K8S_NAMESPACE_NAME]: process.env.K8S_NAMESPACE ?? 'simulated-self',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${ENDPOINT.replace(/\/$/, '')}/v1/traces` }),
  });

  try {
    sdk.start();
  } catch (err) {
    // Tracing must never break the request path — degrade silently.
    console.warn('[otel] failed to start, continuing without traces:', (err as Error).message);
  }

  tracerRef = trace.getTracer(SERVICE_NAME);
  return tracerRef;
}

/** Run `fn` inside a new span; auto-records errors + sets status. */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attrs: Record<string, string | number | boolean> = {},
): Promise<T> {
  const tracer = tracerRef ?? trace.getTracer(SERVICE_NAME);
  return await tracer.startActiveSpan(name, async (span) => {
    Object.entries(attrs).forEach(([k, v]) => span.setAttribute(k, v));
    try {
      const out = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return out;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Extract a propagated traceparent (HTTP headers or WS upgrade). */
export function extractContext(headers: Headers) {
  const carrier: Record<string, string> = {};
  headers.forEach((v, k) => { carrier[k.toLowerCase()] = v; });
  return propagation.extract(context.active(), carrier);
}

/** Current active traceId, or empty string. */
export function currentTraceId(): string {
  return trace.getSpan(context.active())?.spanContext().traceId ?? '';
}

export { context, trace };

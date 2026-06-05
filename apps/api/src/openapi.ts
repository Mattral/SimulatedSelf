/**
 * OpenAPI 3.1 spec for the Simulated-Self API gateway.
 * Served at /openapi.json; Swagger UI at /docs.
 */
export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Simulated-Self API',
    version: '0.1.0',
    description:
      'Health, readiness, vision diagnostics, and Prometheus metrics for the Simulated-Self gateway.',
  },
  servers: [{ url: '/', description: 'current host' }],
  paths: {
    '/healthz': {
      get: {
        summary: 'Liveness probe',
        responses: {
          200: {
            description: 'Process alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok', 'ts'],
                  properties: { ok: { const: true }, ts: { type: 'integer' } },
                },
              },
            },
          },
        },
      },
    },
    '/readyz': {
      get: {
        summary: 'Deep readiness probe',
        description:
          'Aggregates Redis ping, WebSocket session pressure, and model manifest availability.',
        responses: {
          200: { description: 'Ready', content: { 'application/json': { schema: { $ref: '#/components/schemas/Readiness' } } } },
          503: { description: 'Not ready', content: { 'application/json': { schema: { $ref: '#/components/schemas/Readiness' } } } },
        },
      },
    },
    '/diagnostics/vision': {
      get: {
        summary: 'Vision worker model preflight',
        parameters: [
          {
            name: 'modelBaseUrl',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uri' },
            description: 'Override the model base URL (defaults to <origin>/models).',
          },
        ],
        responses: {
          200: { description: 'All model manifests reachable', content: { 'application/json': { schema: { $ref: '#/components/schemas/VisionPreflight' } } } },
          503: { description: 'One or more model manifests failed to resolve', content: { 'application/json': { schema: { $ref: '#/components/schemas/VisionPreflight' } } } },
        },
      },
    },
    '/metrics': {
      get: {
        summary: 'Prometheus metrics',
        responses: {
          200: {
            description: 'text/plain; version=0.0.4',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Readiness: {
        type: 'object',
        required: ['ok', 'ts', 'checks'],
        properties: {
          ok: { type: 'boolean' },
          ts: { type: 'integer' },
          checks: {
            type: 'object',
            properties: {
              redis: { type: 'object', properties: { ok: { type: 'boolean' }, latencyMs: { type: 'integer' }, error: { type: 'string' } } },
              ws: { type: 'object', properties: { ok: { type: 'boolean' }, active: { type: 'integer' }, softCap: { type: 'integer' } } },
              models: { type: 'object', properties: { ok: { type: 'boolean' }, failed: { type: 'array', items: { type: 'string' } } } },
            },
          },
        },
      },
      VisionPreflight: {
        type: 'object',
        required: ['ok', 'modelBaseUrl', 'models', 'message'],
        properties: {
          ok: { type: 'boolean' },
          modelBaseUrl: { type: 'string' },
          worker: { type: 'string' },
          message: { type: 'string' },
          models: {
            type: 'array',
            items: {
              type: 'object',
              required: ['file', 'url', 'ok'],
              properties: {
                file: { type: 'string' },
                url: { type: 'string' },
                ok: { type: 'boolean' },
                status: { type: 'integer' },
                error: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Simulated-Self API · Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#ui', deepLinking: true });
    </script>
  </body>
</html>`;

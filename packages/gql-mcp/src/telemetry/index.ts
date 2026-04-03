/**
 * OpenTelemetry bootstrap for gql-mcp — traces only.
 *
 * Intentionally minimal. Metrics and logs can be added later
 * once you know what you actually want to measure.
 *
 * What this sets up:
 *   Traces → OTLP/HTTP → New Relic or Splunk (configurable)
 *   Auto-instrumentation → outbound HTTP calls get spans automatically
 *                          (covers GQL requests via fetch/http)
 *
 * Span names you'll see in NR/Splunk:
 *   mcp.tool.execute    — one span per tool call (set in mcp-server.ts)
 *   mcp.resource.read   — one span per resource read
 *   mcp.prompt.get      — one span per prompt fetch
 *   gql.request         — child span per GQL HTTP call (set in gql-client.ts)
 *
 * IMPORTANT: call setupTelemetry() as the very first thing in
 * createMcpServer() — OTel patches Node internals at startup.
 *
 * Config (mcp-config.yaml):
 *   telemetry:
 *     enabled: true
 *     service_name: commerce-mcp
 *     service_version: 1.0.0
 *     exporters:
 *       tracing:
 *         otlp:
 *           endpoint: ${env.NEW_RELIC_OTLP_ENDPOINT}
 *           headers:
 *             api-key: ${env.NEW_RELIC_LICENSE_KEY}
 */

import { NodeSDK, api } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { TelemetryConfig } from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state — one SDK instance per process
// ─────────────────────────────────────────────────────────────────────────────

let sdk: NodeSDK | undefined;

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise the OTel SDK with a single OTLP trace exporter.
 *
 * - Safe to call multiple times — subsequent calls are no-ops
 * - Never throws — telemetry failure must not crash the server
 * - Returns true if telemetry was successfully initialised
 */
export function setupTelemetry(config?: TelemetryConfig): boolean {
  if (!config?.enabled) return false;
  if (sdk !== undefined) return true;

  try {
    const serviceName = config.service_name ?? 'xapi-gql-mcp';
    const serviceVersion = config.service_version ?? 'unknown';
    const otlpCfg = config.exporters?.tracing?.otlp;

    // Build trace exporter.
    // Falls back to OTEL_EXPORTER_OTLP_ENDPOINT env var when no config —
    // standard OTel convention, works with any collector out of the box.
    const traceExporter =
      otlpCfg !== undefined
        ? new OTLPTraceExporter({
            url: resolveTracesUrl(otlpCfg.endpoint),
            headers: otlpCfg.headers ?? {},
          })
        : new OTLPTraceExporter(); // reads OTEL_EXPORTER_OTLP_ENDPOINT

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
      }),

      traceExporter,

      // Auto-instrumentation — gives you spans for all outbound HTTP calls
      // (GQL fetch requests) without manual wrapping
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable high-noise instrumentations not useful for an MCP server
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
      ],
    });

    sdk.start();

    process.on('SIGTERM', () => {
      void shutdownTelemetry();
    });

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[gql-mcp] telemetry init failed (continuing without it): ${message}\n`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shutdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flush buffered spans and shut down the SDK.
 * Call this in McpServer.stop() to ensure spans are exported before exit.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk === undefined) return;
  try {
    await sdk.shutdown();
  } catch {
    // best-effort flush — ignore errors
  } finally {
    sdk = undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a tracer for creating spans.
 * Returns a no-op tracer when telemetry is disabled — always safe to call.
 *
 * @example
 * const tracer = getTracer();
 *
 * return tracer.startActiveSpan('mcp.tool.execute', async (span) => {
 *   span.setAttribute(SpanAttributes.TOOL_NAME, toolName);
 *   try {
 *     const result = await runTool();
 *     span.setStatus({ code: SpanStatusCode.OK });
 *     return result;
 *   } catch (err) {
 *     span.recordException(err as Error);
 *     span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
 *     throw err;
 *   } finally {
 *     span.end();
 *   }
 * });
 */
export function getTracer(): api.Tracer {
  return api.trace.getTracer('gql-mcp');
}

// ─────────────────────────────────────────────────────────────────────────────
// Span attribute keys — consistent naming across mcp-server + gql-client
// ─────────────────────────────────────────────────────────────────────────────

/** Attribute keys stamped onto every span. Import from here — never hardcode strings. */
export const SpanAttributes = {
  // Tool spans
  TOOL_NAME: 'mcp.tool.name',
  TOOL_AUTH_MODE: 'mcp.tool.auth_mode',
  TOOL_IS_CUSTOM: 'mcp.tool.is_custom',

  // GQL child spans
  GQL_OPERATION: 'gql.operation.name',
  GQL_ENDPOINT: 'gql.endpoint',
  GQL_STATUS: 'gql.http.status_code',
  GQL_HAS_ERRORS: 'gql.has_errors',
  GQL_RETRY: 'gql.retry_attempt',

  // Resource + Prompt spans
  RESOURCE_URI: 'mcp.resource.uri',
  PROMPT_NAME: 'mcp.prompt.name',

  // Request context
  TRACE_ID: 'request.trace_id',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure endpoint always ends with /v1/traces.
 * NR: https://otlp.nr-data.net:4318     → appends /v1/traces
 * Splunk: https://ingest.us0.signalfx.com → appends /v1/traces
 * Already suffixed values are left untouched.
 */
function resolveTracesUrl(endpoint: string | undefined): string | undefined {
  if (endpoint === undefined) return undefined;
  if (endpoint.endsWith('/v1/traces')) return endpoint;
  return `${endpoint.replace(/\/$/, '')}/v1/traces`;
}

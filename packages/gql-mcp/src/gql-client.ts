import { SpanStatusCode } from '@opentelemetry/api';
import type { RequestContext, GqlResult, GqlError } from './types/index.js';
import { GqlHttpError, GqlExecutionError, GqlTimeoutError } from './types/index.js';
import { getTracer, SpanAttributes } from './telemetry/index.js';
import type { ILogger } from './logger/index.js';
import { noopLogger } from './logger/index.js';

/**
 * GraphQL client — executes operations against the configured endpoint.
 *
 * Handles:
 *   - Static header injection (API keys, service tokens from config)
 *   - Request context forwarding (filtered headers, trace propagation)
 *   - Timeout via AbortController
 *   - One retry on transient network errors and 5xx responses
 *   - Typed error normalisation (GqlHttpError, GqlExecutionError, GqlTimeoutError)
 *   - OTel span per attempt (child of the active tool span)
 *   - Structured logging via injected ILogger
 */

export interface GqlClientOptions {
  /** GraphQL endpoint URL */
  endpoint: string;
  /** Static headers added to every request (API keys, service tokens) */
  headers?: Record<string, string>;
  /** Request timeout in ms. Default: 30000 */
  timeout?: number;
  /**
   * Retries on transient failures (network errors, 5xx).
   * Never retries 4xx — those are caller errors.
   * Default: 1
   */
  retries?: number;
  /** Base delay in ms between retries. Doubles on each attempt. Default: 200 */
  retryDelay?: number;
  /** Logger injected from createMcpServer. Defaults to noopLogger. */
  logger?: ILogger;
}

export class GqlClient {
  private readonly endpoint: string;
  private readonly staticHeaders: Record<string, string>;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly retryDelay: number;
  private readonly logger: ILogger;

  constructor(options: GqlClientOptions) {
    this.endpoint = options.endpoint;
    this.staticHeaders = options.headers ?? {};
    this.timeout = options.timeout ?? 30_000;
    this.retries = options.retries ?? 1;
    this.retryDelay = options.retryDelay ?? 200;
    this.logger = options.logger ?? noopLogger;
  }

  async execute<T = unknown>(
    operationName: string,
    document: string,
    variables: Record<string, unknown>,
    ctx: RequestContext
  ): Promise<GqlResult<T>> {
    const headers = this.assembleHeaders(ctx);
    const body = JSON.stringify({ query: document, variables, operationName });

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await sleep(this.retryDelay * Math.pow(2, attempt - 1));

      try {
        return await this.attempt<T>(operationName, body, headers, attempt);
      } catch (err) {
        if (!isRetryable(err)) throw err;
        lastError = err;
        this.logger.warn('GQL request failed, retrying', {
          operation: operationName,
          attempt,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    throw lastError;
  }

  private async attempt<T>(
    operationName: string,
    body: string,
    headers: Record<string, string>,
    attempt: number
  ): Promise<GqlResult<T>> {
    const tracer = getTracer();

    // This span is automatically a child of the active mcp.tool.execute span
    // — OTel context propagation handles the parent/child wiring.
    return tracer.startActiveSpan('gql.request', async (span) => {
      span.setAttribute(SpanAttributes.GQL_OPERATION, operationName);
      span.setAttribute(SpanAttributes.GQL_ENDPOINT, this.endpoint);
      span.setAttribute(SpanAttributes.GQL_RETRY, attempt);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      this.logger.debug('GQL request', { operation: operationName, attempt });

      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        span.setAttribute(SpanAttributes.GQL_STATUS, response.status);
        this.logger.debug('GQL response', { operation: operationName, status: response.status });

        if (!response.ok) {
          const responseBody = await response.text();
          span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.status}` });
          throw new GqlHttpError(response.status, responseBody, operationName);
        }

        const json = (await response.json()) as { data?: T | null; errors?: GqlError[] };

        if (json.errors && json.errors.length > 0) {
          span.setAttribute(SpanAttributes.GQL_HAS_ERRORS, true);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: json.errors.map((e) => e.message).join(', '),
          });
          throw new GqlExecutionError(json.errors, operationName);
        }

        span.setAttribute(SpanAttributes.GQL_HAS_ERRORS, false);
        span.setStatus({ code: SpanStatusCode.OK });
        return { data: (json.data ?? null) as T };
      } catch (err) {
        if (err instanceof GqlHttpError || err instanceof GqlExecutionError) {
          // already set status above — just rethrow
          throw err;
        }

        if (err instanceof Error && err.name === 'AbortError') {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'timeout' });
          throw new GqlTimeoutError(operationName);
        }

        const message = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        throw new Error(`GraphQL request failed for "${operationName}": ${message}`);
      } finally {
        clearTimeout(timeoutId);
        span.end();
      }
    });
  }

  /**
   * Assemble outbound headers.
   *
   * Merge order (later wins):
   *   1. Static headers from config  — API keys, service tokens
   *   2. Forwarded headers from ctx  — caller's filtered inbound headers
   *   3. content-type               — always application/json, not overridable
   *   4. x-trace-id                 — always set from ctx.traceId
   */
  private assembleHeaders(ctx: RequestContext): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.staticHeaders)) {
      headers[key.toLowerCase()] = value;
    }

    for (const [key, value] of Object.entries(ctx.forwardedHeaders)) {
      headers[key.toLowerCase()] = value;
    }

    headers['content-type'] = 'application/json';

    if (ctx.traceId) {
      headers['x-trace-id'] = ctx.traceId;
    }

    return headers;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof GqlExecutionError) return false;
  if (err instanceof GqlTimeoutError) return true;
  if (err instanceof GqlHttpError) return err.statusCode >= 500;
  return err instanceof Error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

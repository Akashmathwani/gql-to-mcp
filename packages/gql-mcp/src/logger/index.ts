/**
 * Structured logger for gql-mcp — built on Pino.
 *
 * Three formats controlled by config.logging.format:
 *
 *   'pretty' → pino-pretty coloured output to stderr   (local dev)
 *   'json'   → raw NDJSON to stderr                    (prod fallback / Splunk file ingest)
 *   'otel'   → ships logs to NR/Splunk via OTLP        (prod — logs correlated with traces)
 *
 * The 'otel' format is what makes logs show up in New Relic correlated with
 * your mcp.tool.execute and gql.request spans — traceId + spanId are injected
 * automatically from the active OTel context.
 *
 * Redaction:
 *   Pino native redact — dot-path syntax.
 *   e.g. redact: ['headers.authorization', 'jwt.sub', 'args.cardNumber']
 */

import pino, { type Logger as PinoLogger } from 'pino';
import type { LoggingConfig, LogLevel } from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;

  /**
   * Child logger — merges `bindings` into every log entry.
   *
   * @example
   * const reqLog = logger.child({ traceId: ctx.traceId, tool: 'search_catalog' });
   * reqLog.info('Executing');  // every entry includes traceId + tool
   */
  child(bindings: Record<string, unknown>): ILogger;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logger wrapper
// ─────────────────────────────────────────────────────────────────────────────

class Logger implements ILogger {
  constructor(private readonly pino: PinoLogger) {}

  debug(message: string, context?: Record<string, unknown>): void {
    context ? this.pino.debug(context, message) : this.pino.debug(message);
  }

  info(message: string, context?: Record<string, unknown>): void {
    context ? this.pino.info(context, message) : this.pino.info(message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    context ? this.pino.warn(context, message) : this.pino.warn(message);
  }

  error(message: string, context?: Record<string, unknown>): void {
    context ? this.pino.error(context, message) : this.pino.error(message);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new Logger(this.pino.child(bindings));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a logger from McpConfig.logging.
 *
 * format: 'pretty' → local dev coloured output
 * format: 'json'   → NDJSON to stderr (Splunk file scraping / fallback)
 * format: 'otel'   → ships to NR/Splunk via OTLP, correlated with traces
 *
 * For 'otel' to work, setupTelemetry() must have been called first and
 * OTEL_EXPORTER_OTLP_ENDPOINT must be set (same endpoint as traces).
 */
export function createLogger(config?: LoggingConfig, serviceName = 'xapi-gql-mcp'): ILogger {
  const level: LogLevel = config?.level ?? 'info';
  const format = config?.format ?? 'json';
  const redactPaths = config?.redact ?? [];

  const pinoOptions: pino.LoggerOptions = {
    level,
    redact: redactPaths.length > 0 ? { paths: redactPaths, censor: '[REDACTED]' } : undefined,
    base: { service: serviceName },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  };

  let instance: PinoLogger;

  if (format === 'pretty') {
    // Coloured output — local dev only
    instance = pino(
      pinoOptions,
      pino.transport({
        target: require.resolve('pino-pretty'),
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      })
    );
  } else if (format === 'otel') {
    // Ships logs to NR/Splunk via OTLP.
    // Reads OTEL_EXPORTER_OTLP_ENDPOINT + OTEL_EXPORTER_OTLP_HEADERS automatically.
    // Logs are correlated with the active trace span (traceId + spanId injected).
    instance = pino(
      pinoOptions,
      pino.transport({
        target: require.resolve('pino-opentelemetry-transport'),
        options: {
          loggerName: serviceName,
          serviceVersion: '1.0.0',
        },
      })
    );
  } else {
    // json — raw NDJSON to stderr, always works, no external dependency
    instance = pino(pinoOptions, process.stderr);
  }

  return new Logger(instance);
}

// ─────────────────────────────────────────────────────────────────────────────
// No-op logger
// ─────────────────────────────────────────────────────────────────────────────

export const noopLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => noopLogger,
};

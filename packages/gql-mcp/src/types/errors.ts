import type { GqlError } from './gql.js';

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL client errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HTTP-level error from the GraphQL endpoint.
 * Thrown when the response status is not 2xx.
 */
export class GqlHttpError extends Error {
  readonly name = 'GqlHttpError';

  constructor(
    public readonly statusCode: number,
    public readonly body: string,
    public readonly operationName: string
  ) {
    super(`GraphQL HTTP ${statusCode} on "${operationName}"`);
  }
}

/**
 * GraphQL execution error — the HTTP request succeeded but
 * the response contained a non-empty `errors` array.
 */
export class GqlExecutionError extends Error {
  readonly name = 'GqlExecutionError';

  constructor(
    public readonly errors: GqlError[],
    public readonly operationName: string
  ) {
    super(
      `GraphQL execution errors on "${operationName}": ${errors.map((e) => e.message).join(', ')}`
    );
  }
}

/**
 * The GraphQL request exceeded the configured timeout.
 */
export class GqlTimeoutError extends Error {
  readonly name = 'GqlTimeoutError';

  constructor(public readonly operationName: string) {
    super(`GraphQL request timed out on "${operationName}"`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inbound request is missing a JWT or the token is invalid / expired.
 */
export class AuthError extends Error {
  readonly name = 'AuthError';

  constructor(
    message: string,
    public readonly reason: AuthErrorReason
  ) {
    super(message);
  }
}

export type AuthErrorReason =
  | 'missing_token' // No Authorization header present
  | 'invalid_token' // Signature verification failed
  | 'expired_token' // Token has expired (exp < now)
  | 'invalid_issuer' // iss not in configured issuers list
  | 'invalid_audience' // aud does not match configured audience
  | 'insufficient_scope' // Required scopes not present
  | 'jwks_fetch_failed'; // Could not fetch JWKS from issuer

// ─────────────────────────────────────────────────────────────────────────────
// Tool errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tool document hash mismatch — the .graphql file changed on disk
 * after the server started without a reload.
 */
export class ToolIntegrityError extends Error {
  readonly name = 'ToolIntegrityError';

  constructor(public readonly toolName: string) {
    super(`Tool "${toolName}" failed integrity check — document hash mismatch`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config / startup errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration is invalid or missing required fields.
 * Thrown during startup — server will not start.
 */
export class ConfigError extends Error {
  readonly name = 'ConfigError';

  constructor(message: string) {
    super(message);
  }
}

/**
 * One or more .graphql operation files failed validation at startup.
 * Contains all errors collected across all files — not just the first.
 */
export class StartupValidationError extends Error {
  readonly name = 'StartupValidationError';

  constructor(
    public readonly context: string,
    public readonly errors: string[]
  ) {
    super(`Startup validation failed (${context}):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

/**
 * Telemetry initialisation failed.
 * Non-fatal by default — server continues without telemetry.
 */
export class TelemetryInitError extends Error {
  readonly name = 'TelemetryInitError';

  constructor(message: string) {
    super(`Telemetry initialisation failed: ${message}`);
  }
}

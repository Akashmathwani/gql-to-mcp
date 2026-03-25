// ─────────────────────────────────────────────────────────────────────────────
// Request context
// Created once per inbound MCP request and threaded through the entire call stack.
// Never stored beyond the lifetime of a single request.
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestContext {
  /**
   * Trace ID for this request.
   * Extracted from inbound `traceparent` header if present, otherwise generated.
   */
  traceId: string;

  /** All raw headers from the inbound MCP HTTP request (lowercase keys) */
  rawHeaders: Record<string, string>;

  /**
   * Headers filtered by `forward_headers` config.
   * Only these are forwarded to the GraphQL endpoint.
   */
  forwardedHeaders: Record<string, string>;

  /**
   * Parsed and validated JWT payload.
   * Set by auth middleware when `transport.auth.enabled` is true.
   * Undefined for anonymous tool calls or stdio transport.
   */
  jwt?: JwtPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT payload
// Standard OIDC claims + common extensions used in our platform.
// ─────────────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  /** Subject — uniquely identifies the caller */
  sub?: string;

  /** Issuer URL */
  iss?: string;

  /** Audience — single value or array */
  aud?: string | string[];

  /** Expiry (Unix timestamp) */
  exp?: number;

  /** Not before (Unix timestamp) */
  nbf?: number;

  /** Issued at (Unix timestamp) */
  iat?: number;

  /**
   * Space-separated scope string (OAuth 2.0 standard).
   * Use `parseScopes(jwt)` helper to get string[].
   */
  scope?: string;

  /** OAuth 2.0 client ID */
  client_id?: string;

  /** Session ID */
  sid?: string;

  /** Tesco-specific: authentication confidence level */
  confidence_level?: number;

  /** Roles — may be present as a custom claim */
  roles?: string[];

  /** Team — used for CEL RBAC policies */
  team?: string;

  /** Allow any additional claims */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse scope string into array.
 * Handles both space-separated string and pre-split arrays.
 *
 * @example
 * parseScopes({ scope: 'xapi:read xapi:write' }) // ['xapi:read', 'xapi:write']
 * parseScopes({}) // []
 */
export function parseScopes(jwt: JwtPayload): string[] {
  if (!jwt.scope) return [];
  return jwt.scope.split(' ').filter(Boolean);
}

/**
 * Check if a JWT has all required scopes.
 */
export function hasRequiredScopes(jwt: JwtPayload, required: string[]): boolean {
  if (required.length === 0) return true;
  const scopes = parseScopes(jwt);
  return required.every((s) => scopes.includes(s));
}

/**
 * Check if a JWT has at least one of the given scopes.
 */
export function hasAnyScope(jwt: JwtPayload, any: string[]): boolean {
  if (any.length === 0) return true;
  const scopes = parseScopes(jwt);
  return any.some((s) => scopes.includes(s));
}

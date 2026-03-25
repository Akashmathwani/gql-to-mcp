// ─────────────────────────────────────────────────────────────────────────────
// Root config — mirrors the YAML structure loaded by config-loader
// ─────────────────────────────────────────────────────────────────────────────

export interface McpConfig {
  server_info?: ServerInfoConfig;

  /** GraphQL gateway URL */
  endpoint: string;

  /** Static headers added to every outbound GQL request */
  headers?: Record<string, string>;

  /**
   * Headers forwarded from inbound MCP request → GQL endpoint.
   * Only listed headers are forwarded. Hop-by-hop headers are always blocked.
   */
  forward_headers?: string[];

  transport?: TransportConfig;
  schema: SchemaConfig;
  operations: OperationsConfig;
  overrides?: OverridesConfig;
  custom_scalars?: Record<string, JsonSchemaProperty>;
  health_check?: HealthCheckConfig;
  logging?: LoggingConfig;
  telemetry?: TelemetryConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server info
// ─────────────────────────────────────────────────────────────────────────────

export interface ServerInfoConfig {
  name?: string;
  version?: string;
  title?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

export interface TransportConfig {
  type?: 'streamable_http' | 'stdio';
  port?: number;
  address?: string;
  cors?: CorsConfig;

  /**
   * JWT auth for HTTP transport.
   * Ignored when type is 'stdio' (no inbound HTTP headers).
   */
  auth?: TransportAuthConfig;
}

export interface CorsConfig {
  origins?: string[];
  allow_credentials?: boolean;
}

export interface TransportAuthConfig {
  enabled: boolean;

  /**
   * OIDC issuer URLs. JWKS is fetched from {issuer}/.well-known/jwks.json.
   * Multiple issuers supported for migration / multi-tenant scenarios.
   */
  issuers?: string[];

  /** Expected JWT audience claim (aud). Rejected if mismatch. */
  audience?: string;

  scopes?: ScopeConfig;

  /**
   * Resource indicator (RFC 8707). Validated against JWT aud when present.
   */
  resource_url?: string;

  /**
   * Tool names that bypass JWT validation entirely.
   * Use for public/anonymous tools (e.g. healthcheck, public search).
   * All other tools require a valid JWT.
   */
  allow_anonymous_tools?: string[];
}

export interface ScopeConfig {
  /** ALL scopes must be present in the JWT */
  required?: string[];
  /** At least ONE scope must be present in the JWT */
  any?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export interface SchemaConfig {
  source: 'local' | 'introspect';
  /** Required when source is 'local' */
  path?: string;
  /** Required when source is 'introspect' */
  introspect_url?: string;
  introspect_headers?: Record<string, string>;
  /** Watch for file changes and reload (local only) */
  watch?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

export interface OperationsConfig {
  /** One or more directories containing .graphql operation files */
  dirs: string[];
  /** Watch for file changes and reload */
  watch?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overrides
// ─────────────────────────────────────────────────────────────────────────────

export interface OverridesConfig {
  /**
   * 'none'     — mutations are skipped entirely (default, safe for read-only agents)
   * 'explicit' — mutations are included as tools
   */
  mutation_mode?: 'none' | 'explicit';

  /** Override auto-generated tool descriptions. Key = operation name. */
  descriptions?: Record<string, string>;

  /**
   * When true, include the raw GraphQL schema in tool descriptions.
   * Useful for debugging — disable in production.
   */
  output_schema?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthCheckConfig {
  enabled?: boolean;
  /** Defaults to /health */
  path?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

export interface LoggingConfig {
  level?: LogLevel;
  format?: 'json' | 'pretty' | 'otel';
  /** Field paths to redact from logs (e.g. ['headers.authorization', 'jwt.sub']) */
  redact?: string[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export interface TelemetryConfig {
  enabled?: boolean;
  service_name?: string;
  service_version?: string;
  exporters?: TelemetryExportersConfig;
  /** Span attribute keys to omit (e.g. sensitive fields) */
  omit_attributes?: string[];
}

export interface TelemetryExportersConfig {
  tracing?: TracingExporterConfig;
  metrics?: MetricsExporterConfig;
}

export interface TracingExporterConfig {
  otlp?: OtlpConfig;
}

export interface MetricsExporterConfig {
  otlp?: OtlpConfig & {
    temporality?: 'delta' | 'cumulative';
  };
}

export interface OtlpConfig {
  enabled?: boolean;
  endpoint?: string;
  protocol?: 'http/protobuf' | 'grpc';
  headers?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema subset — used for tool input schemas and custom scalar mappings
// ─────────────────────────────────────────────────────────────────────────────

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  format?: string;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  nullable?: boolean;
}

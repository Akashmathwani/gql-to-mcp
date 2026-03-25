// ─────────────────────────────────────────────────────────────────────────────
// Types barrel
// Single import point for all types across the codebase.
//
// Internal modules:  import type { X } from '../types/index.js'
// SDK consumers:     import type { X } from 'gql-mcp'   (re-exported from root index.ts)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Config
  McpConfig,
  ServerInfoConfig,
  TransportConfig,
  TransportAuthConfig,
  CorsConfig,
  ScopeConfig,
  SchemaConfig,
  OperationsConfig,
  OverridesConfig,
  HealthCheckConfig,
  LoggingConfig,
  LogLevel,
  TelemetryConfig,
  TelemetryExportersConfig,
  TracingExporterConfig,
  MetricsExporterConfig,
  OtlpConfig,
  JsonSchemaProperty,
} from './config.js';

export type {
  // Request
  RequestContext,
  JwtPayload,
} from './request.js';

export {
  // Request helpers (functions, not just types)
  parseScopes,
  hasRequiredScopes,
  hasAnyScope,
} from './request.js';

export type {
  // GQL
  GqlResult,
  GqlError,
} from './gql.js';

export type {
  // Tools
  ToolInputSchema,
  ToolDefinition,
  ToolAuthMode,
  OperationVariable,
  CustomTool,
  ToolContext,
  ToolManifestEntry,
} from './tool.js';

export type {
  // Server public API
  McpServerOptions,
  McpServer,
} from './server.js';

export {
  // Errors (classes, not just types — consumers need instanceof)
  GqlHttpError,
  GqlExecutionError,
  GqlTimeoutError,
  AuthError,
  ToolIntegrityError,
  ConfigError,
  StartupValidationError,
  TelemetryInitError,
} from './errors.js';

export type { AuthErrorReason } from './errors.js';

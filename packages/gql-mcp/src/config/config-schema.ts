import { z } from 'zod';

/**
 * Zod schemas for McpConfig validation.
 * Kept separate from config-loader so they can be imported independently
 * in tests and other modules (e.g. auth middleware validating TransportAuthConfig).
 *
 * Zod v4 notes:
 *   - z.record() requires two args: z.record(z.string(), ValueSchema)
 *   - ctx.addIssue() requires code as string literal: { code: 'custom', message, path }
 */

export const ServerInfoSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  title: z.string().optional(),
});

export const CorsSchema = z.object({
  origins: z.array(z.string()).optional(),
  allow_credentials: z.boolean().optional(),
});

export const ScopeConfigSchema = z.object({
  required: z.array(z.string()).optional(),
  any: z.array(z.string()).optional(),
});

export const TransportAuthSchema = z
  .object({
    enabled: z.boolean(),
    issuers: z.array(z.string().url()).optional(),
    audience: z.string().optional(),
    scopes: ScopeConfigSchema.optional(),
    resource_url: z.string().url().optional(),
    allow_anonymous_tools: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enabled && (!data.issuers || data.issuers.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'transport.auth.issuers must have at least one entry when auth is enabled',
        path: ['issuers'],
      });
    }
  });

export const TransportSchema = z.object({
  type: z.enum(['streamable_http', 'stdio']).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  address: z.string().optional(),
  cors: CorsSchema.optional(),
  auth: TransportAuthSchema.optional(),
});

export const SchemaConfigSchema = z
  .object({
    source: z.enum(['local', 'introspect']),
    path: z.string().optional(),
    introspect_url: z.string().url().optional(),
    introspect_headers: z.record(z.string(), z.string()).optional(),
    watch: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'local' && !data.path) {
      ctx.addIssue({
        code: 'custom',
        message: 'schema.path is required when source is "local"',
        path: ['path'],
      });
    }
    if (data.source === 'introspect' && !data.introspect_url) {
      ctx.addIssue({
        code: 'custom',
        message: 'schema.introspect_url is required when source is "introspect"',
        path: ['introspect_url'],
      });
    }
  });

export const OperationsConfigSchema = z.object({
  dirs: z.array(z.string()).min(1, 'operations.dirs must have at least one directory'),
  watch: z.boolean().optional(),
});

export const OverridesConfigSchema = z.object({
  mutation_mode: z.enum(['none', 'explicit']).optional(),
  descriptions: z.record(z.string(), z.string()).optional(),
  output_schema: z.boolean().optional(),
});

export const HealthCheckConfigSchema = z.object({
  enabled: z.boolean().optional(),
  path: z.string().optional(),
});

export const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  format: z.enum(['json', 'pretty', 'otel']).optional(),
  redact: z.array(z.string()).optional(),
});

export const OtlpConfigSchema = z.object({
  enabled: z.boolean().optional(),
  endpoint: z.string().url().optional(),
  protocol: z.enum(['http/protobuf', 'grpc']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const OtlpMetricsConfigSchema = OtlpConfigSchema.extend({
  temporality: z.enum(['delta', 'cumulative']).optional(),
});

export const TelemetryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  service_name: z.string().optional(),
  service_version: z.string().optional(),
  exporters: z
    .object({
      tracing: z.object({ otlp: OtlpConfigSchema.optional() }).optional(),
      metrics: z.object({ otlp: OtlpMetricsConfigSchema.optional() }).optional(),
    })
    .optional(),
  omit_attributes: z.array(z.string()).optional(),
});

export const JsonSchemaPropertySchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']),
    description: z.string().optional(),
    format: z.string().optional(),
    enum: z.array(z.unknown()).optional(),
    items: JsonSchemaPropertySchema.optional(),
    properties: z.record(z.string(), JsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    nullable: z.boolean().optional(),
  })
);

export const McpConfigSchema = z.object({
  server_info: ServerInfoSchema.optional(),
  endpoint: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  forward_headers: z.array(z.string()).optional(),
  transport: TransportSchema.optional(),
  schema: SchemaConfigSchema.optional(),
  operations: OperationsConfigSchema.optional(),
  overrides: OverridesConfigSchema.optional(),
  custom_scalars: z.record(z.string(), JsonSchemaPropertySchema).optional(),
  health_check: HealthCheckConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
  telemetry: TelemetryConfigSchema.optional(),
});

export type ValidatedMcpConfig = z.infer<typeof McpConfigSchema>;

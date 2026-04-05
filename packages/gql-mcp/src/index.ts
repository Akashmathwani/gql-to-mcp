import * as path from 'path';
import { resolveConfig } from './config/config-loader';
import { createLogger } from './logger/index.js';
import { loadSchema } from './schema-loader.js';
import { loadOperations } from './operation-loader.js';
import { ToolRegistry } from './registry/tool-registry.js';
import { ResourceRegistry } from './registry/resource-registry.js';
import type { ResourceDefinition } from './registry/resource-registry.js';
import { PromptRegistry } from './registry/prompt-registry.js';
import type { PromptDefinition } from './registry/prompt-registry.js';
import { GqlClient } from './gql-client.js';
import { McpServer } from './mcp-server.js';
import type {
  McpServerOptions as PublicMcpServerOptions,
  McpServer as PublicMcpServer,
  CustomTool,
} from './types/index.js';
import { setupTelemetry, shutdownTelemetry } from './telemetry/index.js';
// Re-export registry definition types so consumers can use them
export type { ResourceDefinition } from './registry/resource-registry.js';
export type { PromptArgs, PromptMessage } from './registry/prompt-registry.js';
export { promptBuilder } from './registry/prompt-registry.js';

/**
 * Public options for createMcpServer.
 * Extends the base McpServerOptions with resource and prompt registrations.
 */
export interface CreateMcpServerOptions extends PublicMcpServerOptions {
  /**
   * Custom multi-step tools registered alongside .graphql operation tools.
   * Names must not collide with any operation tool name.
   */
  tools?: CustomTool[];

  /**
   * MCP Resources — read-only, URI-addressed data sources for agent context.
   * e.g. schema SDL, runbooks, documentation
   */
  resources?: ResourceDefinition[];

  /**
   * MCP Prompts — parameterised workflow starters for agents.
   * e.g. investigate_ticket, onboard_service
   */
  prompts?: PromptDefinition[];
}

/**
 * Create and configure an MCP server.
 *
 * Loads config → schema → operations → registers all tools, resources, prompts
 * → returns a server instance with start() and stop().
 *

 * ```
 */
function createMcpServer(options: CreateMcpServerOptions): PublicMcpServer {
  // ── Step 1: Config ─────────────────────────────────────────────────────────
  const config = resolveConfig(options.config);

  // Resolve relative paths in schema and operations against the config file's
  // directory so that `./schema.graphql` works regardless of CWD.
  const configDir =
    typeof options.config === 'string' ? path.dirname(path.resolve(options.config)) : process.cwd();

  if (config.schema?.path && !path.isAbsolute(config.schema.path)) {
    config.schema.path = path.resolve(configDir, config.schema.path);
  }
  if (config.operations?.dirs) {
    config.operations.dirs = config.operations.dirs.map((d) =>
      path.isAbsolute(d) ? d : path.resolve(configDir, d)
    );
  }

  // ── Step 2: Logger ─────────────────────────────────────────────────────────
  const logger = createLogger(config.logging, config.server_info?.name);

  const telemetryStarted = setupTelemetry(config.telemetry);

  logger.debug('Telemetry initialised', {
    enabled: config.telemetry?.enabled,
    started: telemetryStarted,
    endpoint: config.telemetry?.exporters?.tracing?.otlp?.endpoint ?? 'none',
  });

  // ── Step 3: Schema ─────────────────────────────────────────────────────────
  let operationTools: ReturnType<typeof loadOperations>['tools'] = [];
  if (config.schema) {
    const schemaResult = loadSchema({ config: config.schema });
    logger.info(`Schema loaded (${schemaResult.source}) — ${schemaResult.typeCount} types`);

    // ── Step 4: Operations → tools ───────────────────────────────────────────
    const operationsResult = loadOperations({
      schema: schemaResult.schema,
      operationsConfig: config.operations,
      overridesConfig: config.overrides,
      customScalars: config.custom_scalars,
      logger,
    });

    for (const skipped of operationsResult.skipped) {
      logger.warn(`Skipped: ${skipped.file} — ${skipped.reason}`);
    }
    operationTools = operationsResult.tools;
  }

  // ── Step 5: Tool registry ──────────────────────────────────────────────────
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerOperationTools(operationTools);

  if (options.tools && options.tools.length > 0) {
    toolRegistry.registerCustomTools(options.tools);
  }

  const { total, operations, custom } = toolRegistry.getToolCount();
  logger.info(`Tools registered — ${total} total (${operations} operations, ${custom} custom)`);

  // ── Step 6: Resource registry ──────────────────────────────────────────────
  const resourceRegistry = new ResourceRegistry();
  if (options.resources && options.resources.length > 0) {
    resourceRegistry.registerAll(options.resources);
    logger.info(`Resources registered — ${resourceRegistry.getResourceCount()}`);
  }

  // ── Step 7: Prompt registry ────────────────────────────────────────────────
  const promptRegistry = new PromptRegistry();
  if (options.prompts && options.prompts.length > 0) {
    promptRegistry.registerAll(options.prompts);
    logger.info(`Prompts registered — ${promptRegistry.getPromptCount()}`);
  }

  // ── Step 8: GQL client ─────────────────────────────────────────────────────
  const gqlClient = new GqlClient({
    endpoint: config.endpoint,
    headers: config.headers,
    logger,
  });

  // ── Step 9: MCP server ─────────────────────────────────────────────────────
  const mcpServer = new McpServer({
    config,
    registry: toolRegistry,
    resources: resourceRegistry,
    prompts: promptRegistry,
    gqlClient,
    logger,
  });

  return {
    async start() {
      await mcpServer.start();
    },
    async stop() {
      await shutdownTelemetry();
      await mcpServer.stop();
    },
    listTools() {
      return toolRegistry.getAllTools(); // already built in step 4
    },
  };
}

// Export the function
export { createMcpServer };

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports — everything a consumer of this package needs
// ─────────────────────────────────────────────────────────────────────────────

// Config types
export type {
  McpConfig,
  TransportConfig,
  TransportAuthConfig,
  SchemaConfig,
  OperationsConfig,
  OverridesConfig,
  TelemetryConfig,
  LoggingConfig,
  JsonSchemaProperty,
} from './types/index.js';

// Tool types
export type { CustomTool, ToolContext, ToolInputSchema, ToolAuthMode } from './types/index.js';

// GQL types
export type { GqlResult, GqlError } from './types/index.js';

// Request types
export type { RequestContext, JwtPayload } from './types/index.js';

// Request helpers
export { parseScopes, hasRequiredScopes, hasAnyScope } from './types/index.js';

// Server public API
export type { McpServerOptions } from './types/index.js';

// Errors — exported as values so consumers can do instanceof checks
export {
  GqlHttpError,
  GqlExecutionError,
  GqlTimeoutError,
  AuthError,
  ToolIntegrityError,
  ConfigError,
  StartupValidationError,
  TelemetryInitError,
} from './types/index.js';

export type { AuthErrorReason } from './types/index.js';

// Registry manifest — useful for agentgateway integration
export type { ToolPolicyManifest, ToolPolicyEntry } from './registry/tool-registry.js';
export type { ILogger } from './logger/index.js';

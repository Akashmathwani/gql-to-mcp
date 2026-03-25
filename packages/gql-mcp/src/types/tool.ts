import type { DocumentNode } from 'graphql';
import type { ZodType } from 'zod';
import type { JsonSchemaProperty } from './config.js';
import type { GqlResult } from './gql.js';
import type { JwtPayload } from './request.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tool input schema — JSON Schema object subset
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation tool — internal model, derived from .graphql files at load time
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;

  /** Raw .graphql source — never mutated after load */
  document: string;

  /** SHA-256 of normalised document — re-verified on every tool call */
  documentHash: string;

  /** Parsed AST — computed once at load time, reused on every call */
  compiledDocument: DocumentNode;

  inputSchema: ToolInputSchema;
  isMutation: boolean;
  filePath: string;

  /**
   * Auth requirement for this tool.
   * 'jwt'       — valid JWT required (default)
   * 'anonymous' — no JWT required, listed in allow_anonymous_tools config
   */
  authMode?: ToolAuthMode;
}

export type ToolAuthMode = 'jwt' | 'anonymous';

// ─────────────────────────────────────────────────────────────────────────────
// Operation variable — intermediate type used during operation loading
// ─────────────────────────────────────────────────────────────────────────────

export interface OperationVariable {
  name: string;
  schema: JsonSchemaProperty;
  required: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom tool — public API for SDK consumers
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema | ZodType;

  /**
   * Auth requirement for this tool.
   * Defaults to 'jwt' — always requires a valid token.
   * Set to 'anonymous' to bypass JWT validation for this tool.
   */
  authMode?: ToolAuthMode;

  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool context — injected into custom tool execute()
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolContext {
  /**
   * Execute a GraphQL operation against the configured endpoint.
   * Headers and auth are forwarded automatically.
   * T should be typed to the expected response shape.
   */
  gql<T = unknown>(operation: string, variables?: Record<string, unknown>): Promise<GqlResult<T>>;

  /** Headers filtered by forward_headers config — forwarded from the inbound MCP request */
  headers: Record<string, string>;

  /**
   * Parsed JWT payload.
   * Available when transport.auth.enabled is true.
   * Undefined for anonymous tools or stdio transport.
   */
  jwt?: JwtPayload;

  /** Trace ID for this request — use for correlation logging */
  traceId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry entry — unified type for operation + custom tools
// Used internally by the registry for getAllTools()
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolManifestEntry {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  authMode: ToolAuthMode;
}

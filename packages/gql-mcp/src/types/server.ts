import type { McpConfig } from './config.js';
import type { CustomTool, ToolManifestEntry } from './tool.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API — what consumers of the SDK interact with
// ─────────────────────────────────────────────────────────────────────────────

export interface McpServerOptions {
  /**
   * Path to mcp-config.yaml, or a pre-loaded McpConfig object.
   * Accepting an object allows programmatic configuration (useful for tests).
   */
  config: string | McpConfig;

  /**
   * Custom multi-step tools to register alongside operation tools.
   * Custom tool names must not collide with any operation tool name.
   */
  tools?: CustomTool[];
}

export interface McpServer {
  /**
   * Start the MCP server on the configured transport.
   * Resolves when the server is ready to accept connections.
   */
  start(): Promise<void>;

  /**
   * Gracefully stop the server and release resources.
   */
  stop(): Promise<void>;

  /**
   * List all registered operation and custom tool definitions.
   */
  listTools(): ToolManifestEntry[];
}

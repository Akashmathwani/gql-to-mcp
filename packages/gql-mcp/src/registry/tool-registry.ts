import { createHash } from 'crypto';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  ToolDefinition,
  CustomTool,
  ToolInputSchema,
  ToolManifestEntry,
  ToolAuthMode,
} from '../types/index.js';
import { ToolIntegrityError, ConfigError } from '../types/index.js';

type NormalizedCustomTool = Omit<CustomTool, 'inputSchema'> & { inputSchema: ToolInputSchema };

function normalizeInputSchema(schema: CustomTool['inputSchema']): ToolInputSchema {
  if (schema instanceof z.ZodType) {
    const toJson = zodToJsonSchema as (s: unknown, opts: unknown) => unknown;
    return toJson(schema, { $refStrategy: 'none' }) as ToolInputSchema;
  }
  return schema;
}

/**
 * Tool registry — in-memory store for operation tools (.graphql files)
 * and custom tools (programmatic, multi-step).
 *
 * Responsibilities:
 *   - Uniqueness enforcement across both tool types
 *   - Hash integrity verification on every operation tool lookup
 *   - Manifest generation for agentgateway auth policy
 *   - Unified tool list for MCP tools/list response
 */
export class ToolRegistry {
  private readonly operationTools = new Map<string, ToolDefinition>();
  private readonly customTools = new Map<string, NormalizedCustomTool>();

  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register operation tools derived from .graphql files.
   * Throws on duplicate names — names must be globally unique across all tool types.
   */
  registerOperationTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      if (this.operationTools.has(tool.name) || this.customTools.has(tool.name)) {
        throw new ConfigError(`Duplicate tool name: "${tool.name}" (operation tool)`);
      }
      this.operationTools.set(tool.name, tool);
    }
  }

  /**
   * Register custom tools provided by SDK consumers.
   * Throws if any name collides with an already-registered tool.
   */
  registerCustomTools(tools: CustomTool[]): void {
    for (const tool of tools) {
      if (this.operationTools.has(tool.name)) {
        throw new ConfigError(
          `Custom tool "${tool.name}" collides with an operation tool — choose a different name`
        );
      }
      if (this.customTools.has(tool.name)) {
        throw new ConfigError(`Duplicate tool name: "${tool.name}" (custom tool)`);
      }
      this.customTools.set(tool.name, {
        ...tool,
        inputSchema: normalizeInputSchema(tool.inputSchema),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lookup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get an operation tool by name.
   *
   * Hash is re-verified on every call — intentional.
   * Guards against in-memory tampering and hot-reload race conditions where a
   * .graphql file changes on disk but the registry hasn't been cleared yet.
   *
   * Throws ToolIntegrityError if the hash doesn't match — hard stop, not silent.
   */
  getOperationTool(name: string): ToolDefinition | undefined {
    const tool = this.operationTools.get(name);
    if (!tool) return undefined;
    this.verifyIntegrity(tool);
    return tool;
  }

  /**
   * Get a custom tool by name.
   * No hash verification — custom tools are in-memory by definition.
   */
  getCustomTool(name: string): NormalizedCustomTool | undefined {
    return this.customTools.get(name);
  }

  /**
   * Check if any tool (operation or custom) exists with this name.
   */
  hasTool(name: string): boolean {
    return this.operationTools.has(name) || this.customTools.has(name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MCP protocol — tools/list
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * All tools in MCP tools/list format.
   * authMode is included so the auth layer can gate calls without re-querying.
   */
  getAllTools(): ToolManifestEntry[] {
    const tools: ToolManifestEntry[] = [];

    for (const tool of this.operationTools.values()) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        authMode: tool.authMode ?? 'jwt',
      });
    }

    for (const tool of this.customTools.values()) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        authMode: tool.authMode ?? 'jwt',
      });
    }

    return tools;
  }

  getAllToolNames(): string[] {
    return [...this.operationTools.keys(), ...this.customTools.keys()];
  }

  getToolCount(): { operations: number; custom: number; total: number } {
    const operations = this.operationTools.size;
    const custom = this.customTools.size;
    return { operations, custom, total: operations + custom };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Manifest — agentgateway auth policy
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a tool policy manifest — a flat map of tool name → auth requirements.
   *
   * Consumed by agentgateway to build CEL RBAC policies without needing to
   * understand MCP tool definitions. Also useful for debugging auth issues.
   *
   * Example output:
   * {
   *   "searchProducts":            { "authMode": "anonymous" },
   *   "getCustomerBuylist":        { "authMode": "jwt" },
   *   "updateShoppingList":        { "authMode": "jwt" },
   * }
   */
  generateManifest(): ToolPolicyManifest {
    const manifest: ToolPolicyManifest = {};

    for (const tool of this.operationTools.values()) {
      manifest[tool.name] = { authMode: tool.authMode ?? 'jwt' };
    }

    for (const tool of this.customTools.values()) {
      manifest[tool.name] = { authMode: tool.authMode ?? 'jwt' };
    }

    return manifest;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clear all tools. Used for hot reload — call before re-registering.
   */
  clear(): void {
    this.operationTools.clear();
    this.customTools.clear();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────────

  private verifyIntegrity(tool: ToolDefinition): void {
    const currentHash = computeDocumentHash(tool.document);
    if (currentHash !== tool.documentHash) {
      throw new ToolIntegrityError(tool.name);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolPolicyEntry {
  authMode: ToolAuthMode;
}

/**
 * Flat map of tool name → auth policy.
 * Written to disk or served at a known endpoint for agentgateway to consume.
 */
export type ToolPolicyManifest = Record<string, ToolPolicyEntry>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SHA-256 of normalised document source.
 * Normalisation strips whitespace differences so formatting changes don't
 * trigger false integrity failures.
 *
 * Must stay in sync with the hash computed in operation-loader at load time.
 */
export function computeDocumentHash(source: string): string {
  const normalized = source.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

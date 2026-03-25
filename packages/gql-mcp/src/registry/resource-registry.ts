import { ConfigError } from '../types/index.js';

/**
 * Resource registry — in-memory store for MCP Resources.
 *
 * Resources are read-only, URI-addressed data sources that an agent can
 * include in its context window. Think of them as GET endpoints — no side
 * effects, just data.
 *
 * MCP protocol primitives handled here:
 *   resources/list  → listResources()
 *   resources/read  → readResource(uri)
 *
 * Examples in our platform:
 *   tesco://schema/graphql       — full federation schema SDL
 *   tesco://runbooks/{service}   — service runbooks for ZenAI investigation
 *   tesco://config/scalars       — custom scalar definitions
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A registered MCP resource definition.
 *
 * uri         — unique identifier, may be a URI template (RFC 6570)
 *               e.g. 'tesco://runbooks/{service}'
 * name        — human-readable display name
 * description — shown to the LLM to help it decide when to read this resource
 * mimeType    — MIME type of the content returned by load()
 *               common values: 'text/plain', 'application/json', 'text/markdown'
 * load()      — called when the agent reads the resource; receives resolved URI params
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
  load(params: ResourceParams): Promise<ResourceContent>;
}

/**
 * Parameters extracted from a URI template match.
 * e.g. 'tesco://runbooks/{service}' matched against 'tesco://runbooks/xapi'
 *      → { service: 'xapi' }
 */
export type ResourceParams = Record<string, string>;

/**
 * Content returned by a resource load() call.
 * text  — for text/plain, text/markdown, application/json (as string)
 * blob  — for binary content (base64 encoded)
 */
export type ResourceContent =
  | { type: 'text'; text: string }
  | { type: 'blob'; blob: string; mimeType: string };

/**
 * MCP resources/list item format.
 */
export interface ResourceListEntry {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export class ResourceRegistry {
  private readonly resources = new Map<string, ResourceDefinition>();

  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a resource.
   * URI must be unique — throws on duplicate.
   */
  register(resource: ResourceDefinition): void {
    if (this.resources.has(resource.uri)) {
      throw new ConfigError(`Duplicate resource URI: "${resource.uri}"`);
    }
    this.resources.set(resource.uri, resource);
  }

  /**
   * Register multiple resources at once.
   */
  registerAll(resources: ResourceDefinition[]): void {
    for (const resource of resources) {
      this.register(resource);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MCP protocol — resources/list
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * All registered resources in MCP list format.
   * Returned directly in the resources/list response.
   */
  listResources(): ResourceListEntry[] {
    return Array.from(this.resources.values()).map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MCP protocol — resources/read
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read a resource by URI.
   *
   * Supports both exact URIs and URI templates (RFC 6570 simple variables).
   * e.g. registering 'tesco://runbooks/{service}' matches 'tesco://runbooks/xapi'
   *      and passes { service: 'xapi' } to load().
   *
   * Returns null if no resource matches — caller should return a 404-style MCP error.
   */
  async readResource(uri: string): Promise<ResourceReadResult | null> {
    // Try exact match first (most common case, no template overhead)
    const exact = this.resources.get(uri);
    if (exact) {
      const content = await exact.load({});
      return { uri, mimeType: exact.mimeType, content };
    }

    // Try template match
    for (const resource of this.resources.values()) {
      const params = matchUriTemplate(resource.uri, uri);
      if (params !== null) {
        const content = await resource.load(params);
        return { uri, mimeType: resource.mimeType, content };
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Introspection
  // ─────────────────────────────────────────────────────────────────────────

  hasResource(uri: string): boolean {
    return this.resources.has(uri);
  }

  getResourceCount(): number {
    return this.resources.size;
  }

  clear(): void {
    this.resources.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────────

export interface ResourceReadResult {
  uri: string;
  mimeType?: string;
  content: ResourceContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// URI template matching — RFC 6570 simple variable expansion only
// Handles {variable} style templates. Does not support operators (+, #, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a URI template against a concrete URI.
 * Returns extracted params if it matches, null if it doesn't.
 *
 * @example
 * matchUriTemplate('tesco://runbooks/{service}', 'tesco://runbooks/xapi')
 * // → { service: 'xapi' }
 *
 * matchUriTemplate('tesco://runbooks/{service}', 'tesco://schema/graphql')
 * // → null
 */
export function matchUriTemplate(template: string, uri: string): ResourceParams | null {
  // Extract variable names from template
  const varNames: string[] = [];
  const regexSource = template.replace(/\{([^}]+)\}/g, (_, name: string) => {
    varNames.push(name);
    return '([^/]+)'; // match one path segment per variable
  });

  // Anchor the pattern to match the full URI
  const regex = new RegExp(`^${regexSource}$`);
  const match = uri.match(regex);

  if (!match) return null;

  // Build params from capture groups
  const params: ResourceParams = {};
  varNames.forEach((name, i) => {
    params[name] = match[i + 1] ?? '';
  });

  return params;
}

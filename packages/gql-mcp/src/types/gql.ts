// ─────────────────────────────────────────────────────────────────────────────
// GraphQL result types
// Used by GqlClient and exposed to custom tool authors via ToolContext.
// ─────────────────────────────────────────────────────────────────────────────

export interface GqlResult<T = unknown> {
  data: T;
  errors?: GqlError[];
}

export interface GqlError {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

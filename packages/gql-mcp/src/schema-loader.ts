import { readFileSync } from 'fs';
import { parse, buildASTSchema, GraphQLSchema } from 'graphql';
import type { SchemaConfig } from './types/index.js';
import { ConfigError } from './types/index.js';

/**
 * Schema loader — loads GraphQLSchema from local file or introspection.
 * M1: local file only. M2: adds introspection support.
 */

export interface SchemaLoaderOptions {
  config: SchemaConfig;
  onReload?: (schema: GraphQLSchema) => void;
}

/**
 * Load GraphQLSchema from configured source.
 * Validates schema has at minimum a Query type.
 * Returns schema and metadata for logging.
 */
export function loadSchema(options: SchemaLoaderOptions): SchemaLoadResult {
  const { config } = options;

  if (config.source === 'local') {
    return loadSchemaFromFile(config.path!);
  }

  if (config.source === 'introspect') {
    throw new ConfigError('Schema introspection not yet implemented (coming in M2)');
  }

  throw new ConfigError(`Unknown schema source: ${String(config.source)}`);
}

/**
 * Load schema from local SDL file.
 */
function loadSchemaFromFile(path: string): SchemaLoadResult {
  let sdl: string;
  try {
    sdl = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new ConfigError(
      `Failed to read schema file at ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let ast;
  try {
    ast = parse(sdl);
  } catch (err) {
    throw new ConfigError(
      `Failed to parse GraphQL schema in ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let schema: GraphQLSchema;
  try {
    schema = buildASTSchema(ast);
  } catch (err) {
    throw new ConfigError(
      `Failed to build GraphQL schema from ${path}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Validate schema has Query type at minimum
  const queryType = schema.getQueryType();
  if (!queryType) {
    throw new ConfigError(`Schema at ${path} is invalid: missing Query type`);
  }

  // Count types for logging
  const typeMap = schema.getTypeMap();
  const typeCount = Object.keys(typeMap).filter((name) => !name.startsWith('__')).length;

  return {
    schema,
    source: 'local',
    path,
    typeCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SchemaLoadResult {
  schema: GraphQLSchema;
  source: 'local' | 'introspect';
  path?: string;
  typeCount: number;
}

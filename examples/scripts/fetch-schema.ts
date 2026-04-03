// scripts/fetch-schema.ts
//
// Fetches the GraphQL schema from the endpoint in mcp-config.yaml via
// introspection and writes the SDL to the path configured in schema.path.
//
// Usage:
//   ts-node --project tsconfig.json scripts/fetch-schema.ts [config-path]
//
// Defaults to ./mcp-config.yaml when no argument is given.

import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { buildClientSchema, getIntrospectionQuery, printSchema, IntrospectionQuery } from 'graphql';

// ── Env-var interpolation (mirrors packages/gql-mcp config-loader) ────────────

function interpolate(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{env\.([A-Z_][A-Z0-9_]*)\}/g, (_match, varName: string) => {
      const value = process.env[varName];
      if (value === undefined) {
        throw new Error(`Environment variable "${varName}" is not set`);
      }
      return value;
    });
  }
  if (Array.isArray(obj)) return obj.map(interpolate);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, interpolate(v)])
    );
  }
  return obj;
}

// ── Config parsing ─────────────────────────────────────────────────────────────

interface Config {
  endpoint: string;
  headers?: Record<string, string>;
  schema?: { path?: string };
}

function loadConfig(configPath: string): Config {
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = yamlLoad(raw);
  return interpolate(parsed) as Config;
}

// ── Introspection ──────────────────────────────────────────────────────────────

async function fetchSchema(endpoint: string, headers: Record<string, string>): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} from ${endpoint}`);
  }

  const body = (await response.json()) as { data?: IntrospectionQuery; errors?: unknown[] };

  if (body.errors?.length) {
    throw new Error(`GraphQL errors:\n${JSON.stringify(body.errors, null, 2)}`);
  }

  if (!body.data) {
    throw new Error('Introspection response has no data');
  }

  const schema = buildClientSchema(body.data);
  return printSchema(schema);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const configArg = process.argv[2] ?? './mcp-config.yaml';
  const configPath = path.resolve(process.cwd(), configArg);

  console.log(`Reading config: ${configPath}`);
  const config = loadConfig(configPath);

  const endpoint = config.endpoint;
  const headers = config.headers ?? {};

  console.log(`Fetching schema from: ${endpoint}`);
  const sdl = await fetchSchema(endpoint, headers);

  const outRelative = config.schema?.path ?? './schema.graphql';
  const outPath = path.resolve(path.dirname(configPath), outRelative);

  writeFileSync(outPath, sdl, 'utf-8');
  console.log(`Schema written to: ${outPath} (${sdl.length} chars)`);
}

main().catch((err) => {
  console.error('fetch-schema failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

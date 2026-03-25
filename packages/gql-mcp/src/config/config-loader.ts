import { readFileSync } from 'fs';
import { load as yamlLoad } from 'js-yaml';
import type { McpConfig } from '../types/index.js';
import { ConfigError } from '../types/index.js';
import { McpConfigSchema } from './config-schema.js';

/**
 * Config loader — resolves, interpolates, and validates McpConfig.
 *
 * Accepts either:
 *   - A file path string → reads YAML, interpolates env vars, validates
 *   - A pre-built McpConfig object → validates only (no file I/O, no interpolation)
 *
 * The second form is primarily for tests and programmatic usage where
 * writing a YAML file on disk would be inconvenient.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve and validate config from a file path or a pre-built object.
 *
 * @throws {ConfigError} on file read failure, YAML parse failure, or schema validation failure
 */
export function resolveConfig(input: string | McpConfig): McpConfig {
  if (typeof input === 'string') {
    return loadFromFile(input);
  }
  return validateObject(input);
}

/**
 * @deprecated Use resolveConfig() instead.
 * Kept for backwards compatibility — existing consumers calling loadConfig(path) still work.
 */
export function loadConfig(configPath: string): McpConfig {
  return resolveConfig(configPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// File path → McpConfig
// ─────────────────────────────────────────────────────────────────────────────

function loadFromFile(configPath: string): McpConfig {
  const raw = readFile(configPath);
  const parsed = parseYaml(raw, configPath);
  const interpolated = interpolateEnvVars(parsed);
  return validate(interpolated, `config file "${configPath}"`);
}

function readFile(configPath: string): string {
  try {
    return readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new ConfigError(
      `Failed to read config file at "${configPath}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function parseYaml(raw: string, configPath: string): unknown {
  try {
    return yamlLoad(raw);
  } catch (err) {
    throw new ConfigError(
      `Failed to parse YAML in "${configPath}": ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Object → McpConfig (programmatic / test path)
// ─────────────────────────────────────────────────────────────────────────────

function validateObject(config: McpConfig): McpConfig {
  // Still run Zod validation — don't trust the object blindly.
  // This catches misconfigured programmatic configs early with clear error messages
  // rather than failing silently at runtime.
  return validate(config, 'programmatic config');
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared validation
// ─────────────────────────────────────────────────────────────────────────────

function validate(input: unknown, source: string): McpConfig {
  const result = McpConfigSchema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => {
        const path = e.path.length > 0 ? e.path.join('.') : '(root)';
        return `  - ${path}: ${e.message}`;
      })
      .join('\n');

    throw new ConfigError(`Config validation failed (${source}):\n${errors}`);
  }

  return result.data as McpConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Env var interpolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively replaces ${env.VAR_NAME} references in string values.
 *
 * Supports both exact and inline forms:
 *   "${env.TOKEN}"          → full env value
 *   "Bearer ${env.TOKEN}"   → interpolated within the string
 *
 * Only uppercase env var names are supported (A-Z, 0-9, underscore).
 * Throws ConfigError if a referenced var is not set — fail fast at startup.
 */
export function interpolateEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{env\.([A-Z_][A-Z0-9_]*)\}/g, (match, varName: string) => {
      const value = process.env[varName];
      if (value === undefined) {
        throw new ConfigError(
          `Environment variable "${varName}" is not set (referenced as "${match}" in config)`
        );
      }
      return value;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(interpolateEnvVars);
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        key,
        interpolateEnvVars(value),
      ])
    );
  }

  // Numbers, booleans, null — pass through unchanged
  return obj;
}

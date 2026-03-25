import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { sync as globSync } from 'glob';
import {
  parse,
  validate,
  type GraphQLSchema,
  type DocumentNode,
  type OperationDefinitionNode,
  type VariableDefinitionNode,
  type GraphQLNamedType,
  type GraphQLType,
  isNonNullType,
  isListType,
  isScalarType,
  isEnumType,
  isInputObjectType,
  OperationTypeNode,
  Kind,
} from 'graphql';
import type {
  ToolDefinition,
  ToolInputSchema,
  OperationsConfig,
  OverridesConfig,
  JsonSchemaProperty,
} from './types/index.js';
import { StartupValidationError } from './types/index.js';

/**
 * Operation loader — globs .graphql files, parses, validates, extracts variables,
 * builds JSON schemas with descriptions, computes hashes.
 *
 * Description precedence for the tool itself:
 *   1. config overrides.descriptions[operationName]   — explicit config override
 *   2. Top-level # comment in .graphql file           — agent-facing description
 *   3. Generic fallback                               — last resort
 *
 * Description precedence for each input variable:
 *   1. Inline # comment above $variable in .graphql  — agent-facing, specific
 *   2. GraphQL schema description on the input type   — schema-level fallback
 *   3. No description                                 — LLM sees type only
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface OperationLoaderOptions {
  schema: GraphQLSchema;
  operationsConfig: OperationsConfig;
  overridesConfig?: OverridesConfig;
  customScalars?: Record<string, JsonSchemaProperty>;
}

export interface OperationLoadResult {
  tools: ToolDefinition[];
  skipped: Array<{ file: string; reason: string }>;
}

export function loadOperations(options: OperationLoaderOptions): OperationLoadResult {
  const { schema, operationsConfig, overridesConfig, customScalars } = options;
  const mutationMode = overridesConfig?.mutation_mode ?? 'none';

  const tools: ToolDefinition[] = [];
  const skipped: Array<{ file: string; reason: string }> = [];
  const errors: Array<{ file: string; errors: string[] }> = [];

  // Glob all .graphql files from all configured dirs
  const files: string[] = [];
  for (const dir of operationsConfig.dirs) {
    const matches = globSync(`${dir}/**/*.graphql`, { absolute: true });
    files.push(...matches);
  }

  if (files.length === 0) {
    throw new StartupValidationError('operations', [
      `No .graphql files found in: ${operationsConfig.dirs.join(', ')}`,
    ]);
  }

  for (const filePath of files) {
    try {
      const tool = loadOperation({
        filePath,
        schema,
        mutationMode,
        overridesConfig,
        customScalars,
      });

      if (tool === null) {
        skipped.push({ file: filePath, reason: 'mutation skipped (mutation_mode: none)' });
        continue;
      }

      tools.push(tool);
    } catch (err) {
      if (err instanceof OperationValidationError) {
        errors.push({ file: filePath, errors: err.errors });
      } else {
        errors.push({ file: filePath, errors: [err instanceof Error ? err.message : String(err)] });
      }
    }
  }

  if (errors.length > 0) {
    const messages = errors.flatMap((e) => e.errors.map((msg) => `${e.file}:\n  ${msg}`));
    throw new StartupValidationError('operations', messages);
  }

  return { tools, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Single file loader
// ─────────────────────────────────────────────────────────────────────────────

function loadOperation(options: {
  filePath: string;
  schema: GraphQLSchema;
  mutationMode: 'none' | 'explicit';
  overridesConfig?: OverridesConfig;
  customScalars?: Record<string, JsonSchemaProperty>;
}): ToolDefinition | null {
  const { filePath, schema, mutationMode, overridesConfig, customScalars } = options;

  const source = readFile(filePath);
  const document = parseDocument(source);
  const operation = extractOperation(document);
  const operationName = requireName(operation);
  const isMutation = operation.operation === OperationTypeNode.MUTATION;

  if (isMutation && mutationMode === 'none') return null;

  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    throw new OperationValidationError(
      validationErrors.map((e) => `${e.message} (line ${e.locations?.[0]?.line ?? '?'})`)
    );
  }

  // Extract variable-level comments from raw source before building schema
  const variableComments = extractVariableComments(source);

  const variables = operation.variableDefinitions ?? [];
  const inputSchema = buildInputSchema(variables, schema, customScalars, variableComments);
  const documentHash = computeDocumentHash(source);
  const description = resolveOperationDescription({
    operationName,
    source,
    overrides: overridesConfig?.descriptions,
    isMutation,
  });

  return {
    name: operationName,
    description,
    document: source,
    documentHash,
    compiledDocument: document,
    inputSchema,
    isMutation,
    filePath,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Variable comment extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract inline comments written directly above each $variable declaration.
 *
 * Supports both patterns:
 *
 *   # The product SKU to look up
 *   $productId: ID!
 *
 *   $currency: String  # ISO 4217 currency code, defaults to GBP
 *
 * Returns a map of variableName → comment text.
 */
function extractVariableComments(source: string): Record<string, string> {
  const comments: Record<string, string> = {};
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Pattern 1: $varName on this line, comment on preceding line
    const varMatch = line.match(/^\$([A-Za-z_][A-Za-z0-9_]*)[\s:]/);
    if (varMatch) {
      const varName = varMatch[1];

      // Look for a comment on the line immediately above
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        const prevComment = prevLine.match(/^#\s*(.+)/);
        if (prevComment) {
          comments[varName] = prevComment[1].trim();
          continue;
        }
      }

      // Pattern 2: inline comment on the same line as $varName
      // e.g.  $currency: String  # ISO 4217 currency code
      const inlineComment = line.match(/#\s*(.+)$/);
      if (inlineComment) {
        comments[varName] = inlineComment[1].trim();
      }
    }
  }

  return comments;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input schema builder
// ─────────────────────────────────────────────────────────────────────────────

function buildInputSchema(
  variables: readonly VariableDefinitionNode[],
  schema: GraphQLSchema,
  customScalars: Record<string, JsonSchemaProperty> | undefined,
  variableComments: Record<string, string>
): ToolInputSchema {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const varDef of variables) {
    const varName = varDef.variable.name.value;
    const { jsonSchema, isRequired } = mapGraphQLTypeNode(varDef.type, schema, customScalars);

    // Apply description from comment or schema — comment wins
    const description = resolveVariableDescription(varName, varDef, schema, variableComments);
    if (description) {
      jsonSchema.description = description;
    }

    properties[varName] = jsonSchema;
    if (isRequired) required.push(varName);
  }

  return { type: 'object', properties, required };
}

/**
 * Resolve the description for a single variable.
 *
 * Precedence:
 *   1. Inline # comment in .graphql file
 *   2. GraphQL schema description on the named input type
 *   3. undefined — no description set
 */
function resolveVariableDescription(
  varName: string,
  varDef: VariableDefinitionNode,
  schema: GraphQLSchema,
  variableComments: Record<string, string>
): string | undefined {
  // 1. Inline comment — highest priority
  if (variableComments[varName]) {
    return variableComments[varName];
  }

  // 2. GraphQL schema description — walk through NonNull/List wrappers to get named type
  const typeName = unwrapTypeName(varDef.type);
  if (typeName) {
    const gqlType = schema.getType(typeName);
    if (gqlType?.description) {
      return gqlType.description;
    }
  }

  return undefined;
}

/**
 * Walk through NonNull and List wrappers to get the base named type name.
 * e.g. [ID!]! → 'ID'
 */
function unwrapTypeName(typeNode: VariableDefinitionNode['type']): string | undefined {
  if (typeNode.kind === Kind.NAMED_TYPE) return typeNode.name.value;
  if (typeNode.kind === Kind.NON_NULL_TYPE) return unwrapTypeName(typeNode.type);
  if (typeNode.kind === Kind.LIST_TYPE) return unwrapTypeName(typeNode.type);
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL type → JSON Schema
// Two separate functions because AST nodes and runtime types have different APIs.
// Do not merge — mapGraphQLTypeNode handles AST, mapGraphQLRuntimeType handles runtime.
// ─────────────────────────────────────────────────────────────────────────────

function mapGraphQLTypeNode(
  typeNode: VariableDefinitionNode['type'],
  schema: GraphQLSchema,
  customScalars?: Record<string, JsonSchemaProperty>
): { jsonSchema: JsonSchemaProperty; isRequired: boolean } {
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    const inner = mapGraphQLTypeNode(typeNode.type, schema, customScalars);
    return { jsonSchema: inner.jsonSchema, isRequired: true };
  }

  if (typeNode.kind === Kind.LIST_TYPE) {
    const inner = mapGraphQLTypeNode(typeNode.type, schema, customScalars);
    return { jsonSchema: { type: 'array', items: inner.jsonSchema }, isRequired: false };
  }

  if (typeNode.kind === Kind.NAMED_TYPE) {
    const typeName = typeNode.name.value;
    const gqlType = schema.getType(typeName);

    if (!gqlType) throw new Error(`Unknown type: ${typeName}`);

    if (customScalars?.[typeName]) {
      return { jsonSchema: { ...customScalars[typeName] }, isRequired: false };
    }

    if (isScalarType(gqlType)) {
      return { jsonSchema: mapBuiltinScalar(typeName), isRequired: false };
    }

    if (isEnumType(gqlType)) {
      return {
        jsonSchema: {
          type: 'string',
          enum: gqlType.getValues().map((v) => v.value as string),
          description: gqlType.description ?? undefined,
        },
        isRequired: false,
      };
    }

    if (isInputObjectType(gqlType)) {
      const fields = gqlType.getFields();
      const properties: Record<string, JsonSchemaProperty> = {};
      const required: string[] = [];

      for (const [fieldName, field] of Object.entries(fields)) {
        const { jsonSchema, isRequired } = mapGraphQLRuntimeType(field.type, schema, customScalars);
        if (field.description) jsonSchema.description = field.description;
        properties[fieldName] = jsonSchema;
        if (isRequired) required.push(fieldName);
      }

      return {
        jsonSchema: {
          type: 'object',
          properties,
          required,
          description: gqlType.description ?? undefined,
        },
        isRequired: false,
      };
    }
  }

  throw new Error(`Unsupported type node: ${JSON.stringify(typeNode)}`);
}

function mapGraphQLRuntimeType(
  gqlType: GraphQLType,
  schema: GraphQLSchema,
  customScalars?: Record<string, JsonSchemaProperty>
): { jsonSchema: JsonSchemaProperty; isRequired: boolean } {
  if (isNonNullType(gqlType)) {
    const inner = mapGraphQLRuntimeType(gqlType.ofType, schema, customScalars);
    return { jsonSchema: inner.jsonSchema, isRequired: true };
  }

  if (isListType(gqlType)) {
    const inner = mapGraphQLRuntimeType(gqlType.ofType, schema, customScalars);
    return { jsonSchema: { type: 'array', items: inner.jsonSchema }, isRequired: false };
  }

  const namedType = gqlType as GraphQLNamedType;
  const typeName = namedType.name;

  if (customScalars?.[typeName]) {
    return { jsonSchema: { ...customScalars[typeName] }, isRequired: false };
  }

  if (isScalarType(namedType)) {
    return { jsonSchema: mapBuiltinScalar(typeName), isRequired: false };
  }

  if (isEnumType(namedType)) {
    return {
      jsonSchema: {
        type: 'string',
        enum: namedType.getValues().map((v) => v.value as string),
        description: namedType.description ?? undefined,
      },
      isRequired: false,
    };
  }

  if (isInputObjectType(namedType)) {
    const fields = namedType.getFields();
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      const { jsonSchema, isRequired } = mapGraphQLRuntimeType(field.type, schema, customScalars);
      if (field.description) jsonSchema.description = field.description;
      properties[fieldName] = jsonSchema;
      if (isRequired) required.push(fieldName);
    }

    return {
      jsonSchema: {
        type: 'object',
        properties,
        required,
        description: namedType.description ?? undefined,
      },
      isRequired: false,
    };
  }

  throw new Error(`Unsupported GraphQL type: ${typeName}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scalar mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapBuiltinScalar(scalarName: string): JsonSchemaProperty {
  switch (scalarName) {
    case 'String':
      return { type: 'string' };
    case 'Int':
      return { type: 'integer' };
    case 'Float':
      return { type: 'number' };
    case 'Boolean':
      return { type: 'boolean' };
    case 'ID':
      return { type: 'string' };
    default:
      console.error(
        `⚠ Unknown scalar "${scalarName}" — falling back to string. ` +
          `Add it to custom_scalars in config to suppress this warning.`
      );
      return { type: 'string' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Description resolution
// ─────────────────────────────────────────────────────────────────────────────

function resolveOperationDescription(options: {
  operationName: string;
  source: string;
  overrides?: Record<string, string>;
  isMutation: boolean;
}): string {
  const { operationName, source, overrides, isMutation } = options;

  // 1. Explicit config override
  if (overrides?.[operationName]) return overrides[operationName];

  // 2. Top-level comment in the file (first # comment line)
  // Skip blank lines before the comment but stop at the first non-comment line
  const lines = source.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const match = trimmed.match(/^#\s*(.+)/);
    if (match) return match[1].trim();
    break; // first non-blank, non-comment line — no top comment
  }

  // 3. Generic fallback
  const opType = isMutation ? 'mutation' : 'query';
  return `Executes the ${operationName} GraphQL ${opType}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// File / parse helpers
// ─────────────────────────────────────────────────────────────────────────────

function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function parseDocument(source: string): DocumentNode {
  try {
    return parse(source);
  } catch (err) {
    throw new Error(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function extractOperation(document: DocumentNode): OperationDefinitionNode {
  const op = document.definitions.find(
    (def): def is OperationDefinitionNode => def.kind === Kind.OPERATION_DEFINITION
  );
  if (!op) throw new Error('No operation definition found in file');
  return op;
}

function requireName(operation: OperationDefinitionNode): string {
  const name = operation.name?.value;
  if (!name) throw new Error('Operation must have a name');
  return name;
}

function computeDocumentHash(source: string): string {
  const normalized = source.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal error
// ─────────────────────────────────────────────────────────────────────────────

class OperationValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super('Operation validation failed');
    this.name = 'OperationValidationError';
  }
}

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Server as McpSdkServer } from '@modelcontextprotocol/sdk/server/index.js';
import type { TransportConfig, RequestContext } from '../types/index.js';

/**
 * HTTP transport layer — owns everything below the MCP protocol:
 *   - Node HTTP server lifecycle (listen, close)
 *   - CORS preflight handling
 *   - Request body parsing
 *   - RequestContext construction from raw headers
 *   - Streamable HTTP transport wiring per request
 *
 * McpServer calls createHttpTransport() and gets back a running server.
 * It never touches IncomingMessage or ServerResponse directly.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory function the HTTP transport calls for each inbound MCP request.
 * McpServer implements this — returns a fresh configured MCP SDK Server instance.
 * Receives the RequestContext built from incoming headers.
 */
export type McpInstanceFactory = (ctx?: RequestContext) => McpSdkServer;

export interface HttpTransportOptions {
  config: TransportConfig;
  createInstance: McpInstanceFactory;
}

export interface HttpTransportHandle {
  /** Resolves when the server is listening */
  readonly port: number;
  readonly address: string;
  close(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MCP_PATH = '/mcp';
const HEALTH_PATH = '/health';
const DEFAULT_PORT = 3000;
const DEFAULT_ADDRESS = 'localhost';
//TODO
const DEFAULT_CORS_ORIGINS = ['http://localhost:6274']; // MCP Inspector default

/**
 * Headers always included in Access-Control-Allow-Headers.
 * mcp-session-id is required by the MCP streamable HTTP spec.
 */
const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'mcp-session-id',
  'traceparent',
  'tracestate',
].join(', ');

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create and start an HTTP server for the MCP streamable HTTP transport.
 * Returns a handle for logging and graceful shutdown.
 */
export async function createHttpTransport(
  options: HttpTransportOptions
): Promise<HttpTransportHandle> {
  const { config, createInstance } = options;

  const port = config.port ?? DEFAULT_PORT;
  const address = config.address ?? DEFAULT_ADDRESS;
  const allowedOrigins = config.cors?.origins ?? DEFAULT_CORS_ORIGINS;

  const httpServer: Server = createServer((req, res) => {
    void handleRequest(req, res, { allowedOrigins, createInstance });
  });

  await listen(httpServer, port, address);

  return {
    port,
    address,
    close: () => closeServer(httpServer),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Request handling
// ─────────────────────────────────────────────────────────────────────────────

interface RequestHandlerDeps {
  allowedOrigins: string[];
  createInstance: McpInstanceFactory;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: RequestHandlerDeps
): Promise<void> {
  const { allowedOrigins, createInstance } = deps;
  const url = req.url ?? '';

  // ── Health check ──────────────────────────────────────────────────────────
  if (url === HEALTH_PATH || url === `${HEALTH_PATH}/`) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // ── Route guard ───────────────────────────────────────────────────────────
  if (!url.startsWith(MCP_PATH)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // ── CORS ──────────────────────────────────────────────────────────────────
  const origin = normalizeHeader(req.headers['origin']);
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
    res.setHeader('Vary', 'Origin');
  }

  // ── Preflight ─────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  // ── MCP request ───────────────────────────────────────────────────────────
  try {
    const body = await readBody(req);
    const ctx = buildRequestContext(req);

    // Fresh MCP server + transport per request (stateless mode).
    // No session affinity — safe for tool-only servers.
    // Pass context so MCP server can access incoming headers.
    const mcpInstance = createInstance(ctx);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Attach context to response for downstream use (auth middleware, logging)
    (res as ResponseWithContext).__mcpCtx = ctx;

    res.on('close', () => {
      void transport.close();
      void mcpInstance.close();
    });

    await mcpInstance.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' })
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RequestContext construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a RequestContext from the raw Node IncomingMessage.
 * Extracts trace ID from traceparent header or generates one.
 * JWT extraction happens later in auth middleware — not here.
 */
export function buildRequestContext(req: IncomingMessage): RequestContext {
  const rawHeaders = extractRawHeaders(req);
  const traceId = extractTraceId(rawHeaders);

  return {
    traceId,
    rawHeaders,
    forwardedHeaders: {}, // populated by McpServer.filterHeaders() using config
    jwt: undefined, // populated by auth middleware when enabled
  };
}

/**
 * Extract all inbound headers as a flat lowercase-keyed record.
 * Joins multi-value headers with ', ' per HTTP spec.
 */
function extractRawHeaders(req: IncomingMessage): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    result[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return result;
}

/**
 * Extract trace ID from W3C traceparent header, or generate a new UUID.
 * traceparent format: 00-{traceId}-{spanId}-{flags}
 */
function extractTraceId(headers: Record<string, string>): string {
  const traceparent = headers['traceparent'];
  if (traceparent) {
    const parts = traceparent.split('-');
    // parts[1] is the 32-char trace ID
    if (parts.length >= 2 && parts[1].length === 32) {
      return parts[1];
    }
  }
  return randomUUID().replace(/-/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw.trim()) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Request body is not valid JSON'));
      }
    });

    req.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Server lifecycle
// ─────────────────────────────────────────────────────────────────────────────

function listen(server: Server, port: number, address: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, address, () => resolve());
    server.once('error', reject);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

// Augment ServerResponse to carry RequestContext for middleware access
interface ResponseWithContext extends ServerResponse {
  __mcpCtx?: RequestContext;
}

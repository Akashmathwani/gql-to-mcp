import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SpanStatusCode } from '@opentelemetry/api';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { McpConfig, RequestContext } from './types/index.js';
import { ToolRegistry } from './registry/tool-registry.js';
import { ResourceRegistry } from './registry/resource-registry.js';
import { PromptRegistry } from './registry/prompt-registry.js';
import { GqlClient } from './gql-client.js';
import { createHttpTransport, createStdioTransport } from './transport/index.js';
import type { HttpTransportHandle, StdioTransportHandle } from './transport/index.js';
import { getTracer, SpanAttributes } from './telemetry/index.js';
import type { ILogger } from './logger/index.js';
import { noopLogger } from './logger/index.js';

export interface McpServerOptions {
  config: McpConfig;
  registry: ToolRegistry;
  resources?: ResourceRegistry;
  prompts?: PromptRegistry;
  gqlClient: GqlClient;
  logger?: ILogger;
}

export class McpServer {
  private readonly config: McpConfig;
  private readonly tools: ToolRegistry;
  private readonly resources: ResourceRegistry;
  private readonly prompts: PromptRegistry;
  private readonly gqlClient: GqlClient;
  private readonly ajv: Ajv;
  private readonly logger: ILogger;

  private stdioHandle?: StdioTransportHandle;
  private httpHandle?: HttpTransportHandle;

  /** Incoming request context from HTTP transport (headers, trace ID, JWT) */
  private incomingContext?: RequestContext;

  constructor(options: McpServerOptions) {
    this.config = options.config;
    this.tools = options.registry;
    this.resources = options.resources ?? new ResourceRegistry();
    this.prompts = options.prompts ?? new PromptRegistry();
    this.gqlClient = options.gqlClient;
    this.logger = options.logger ?? noopLogger;
    this.ajv = new Ajv({ strict: false });
    addFormats(this.ajv);
  }

  /**
   * Set the incoming request context from the HTTP transport.
   * Called by the HTTP transport factory for each request.
   */
  setIncomingContext(ctx: RequestContext): void {
    this.incomingContext = ctx;
  }

  async start(): Promise<void> {
    const transportType = this.config.transport?.type ?? 'stdio';
    if (transportType === 'streamable_http') {
      await this.startHttp();
    } else {
      await this.startStdio();
    }
  }

  async stop(): Promise<void> {
    await this.stdioHandle?.close();
    await this.httpHandle?.close();
    this.stdioHandle = undefined;
    this.httpHandle = undefined;
  }

  private async startStdio(): Promise<void> {
    const instance = this.createMcpInstance();
    this.stdioHandle = await createStdioTransport(instance);
    this.logger.info('MCP server started', { transport: 'stdio', ...this.startupSummary() });
  }

  private async startHttp(): Promise<void> {
    if (!this.config.transport) throw new Error('transport config required for streamable_http');
    this.httpHandle = await createHttpTransport({
      config: this.config.transport,
      createInstance: (ctx) => {
        const instance = this.createMcpInstance();
        if (ctx) this.setIncomingContext(ctx);
        return instance;
      },
    });
    const { port, address } = this.httpHandle;
    this.logger.info('MCP server started', {
      transport: 'streamable_http',
      url: `http://${address}:${port}/mcp`,
      ...this.startupSummary(),
    });
  }

  private startupSummary(): Record<string, unknown> {
    const { total, operations, custom } = this.tools.getToolCount();
    return {
      tools: total,
      operationTools: operations,
      customTools: custom,
      resources: this.resources.getResourceCount(),
      prompts: this.prompts.getPromptCount(),
    };
  }

  private createMcpInstance(): Server {
    const capabilities = {
      tools: {},
      ...(this.resources.getResourceCount() > 0 ? { resources: {} } : {}),
      ...(this.prompts.getPromptCount() > 0 ? { prompts: {} } : {}),
    };

    const server = new Server(
      {
        name: this.config.server_info?.name ?? 'gql-mcp',
        version: this.config.server_info?.version ?? '0.1.0',
      },
      { capabilities }
    );

    this.registerHandlers(server);
    return server;
  }

  private registerHandlers(server: Server): void {
    server.setRequestHandler(ListToolsRequestSchema, () => this.handleListTools());
    server.setRequestHandler(CallToolRequestSchema, (req) => this.handleCallTool(req));

    if (this.resources.getResourceCount() > 0) {
      server.setRequestHandler(ListResourcesRequestSchema, () => this.handleListResources());
      server.setRequestHandler(ReadResourceRequestSchema, (req) => this.handleReadResource(req));
    }

    if (this.prompts.getPromptCount() > 0) {
      server.setRequestHandler(ListPromptsRequestSchema, () => this.handleListPrompts());
      server.setRequestHandler(GetPromptRequestSchema, (req) => this.handleGetPrompt(req));
    }
  }

  // ── Tools ────────────────────────────────────────────────────────────────

  private handleListTools(): { tools: Tool[] } {
    return {
      tools: this.tools.getAllTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })) as Tool[],
    };
  }

  private async handleCallTool(request: {
    params: { name: string; arguments?: Record<string, unknown> };
  }): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const { name: toolName, arguments: args = {} } = request.params;
    const tracer = getTracer();

    return tracer.startActiveSpan('mcp.tool.execute', async (span) => {
      const operationTool = this.tools.getOperationTool(toolName);
      const customTool = operationTool ? undefined : this.tools.getCustomTool(toolName);
      const isCustom = customTool !== undefined;

      span.setAttribute(SpanAttributes.TOOL_NAME, toolName);
      span.setAttribute(SpanAttributes.TOOL_IS_CUSTOM, isCustom);

      const reqLog = this.logger.child({ tool: toolName, traceId: this.incomingContext?.traceId });

      if (!operationTool && !customTool) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Tool not found: "${toolName}"` });
        span.end();
        return this.errorResponse(`Tool not found: "${toolName}"`);
      }

      const tool = (operationTool ?? customTool)!;
      span.setAttribute(SpanAttributes.TOOL_AUTH_MODE, tool.authMode ?? 'jwt');

      const valid = this.ajv.validate(tool.inputSchema, args);
      if (!valid) {
        const details = this.ajv.errors
          ?.map((e) => `${e.instancePath || '(root)'} ${e.message}`)
          .join('; ');
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Invalid arguments: ${details}` });
        span.end();
        return this.errorResponse(`Invalid arguments: ${details}`);
      }

      const ctx = this.buildContext();
      span.setAttribute(SpanAttributes.TRACE_ID, ctx.traceId);

      reqLog.debug('Executing tool');

      try {
        let result: unknown;

        if (operationTool) {
          const gqlResult = await this.gqlClient.execute(
            operationTool.name,
            operationTool.document,
            args,
            ctx
          );
          result = gqlResult.data;
        } else if (customTool) {
          result = await customTool.execute(args, {
            gql: (operation, variables) =>
              this.gqlClient.execute('customTool', operation, variables ?? {}, ctx),
            headers: ctx.forwardedHeaders,
            jwt: ctx.jwt,
            traceId: ctx.traceId,
          });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        reqLog.debug('Tool executed successfully');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        reqLog.error('Tool execution failed', { err: message });
        return this.errorResponse(`Tool execution failed: ${message}`);
      } finally {
        span.end();
      }
    });
  }

  // ── Resources ────────────────────────────────────────────────────────────

  private handleListResources(): { resources: ReturnType<ResourceRegistry['listResources']> } {
    return { resources: this.resources.listResources() };
  }

  private async handleReadResource(request: { params: { uri: string } }): Promise<{
    contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>;
  }> {
    const { uri } = request.params;
    const tracer = getTracer();

    return tracer.startActiveSpan('mcp.resource.read', async (span) => {
      span.setAttribute(SpanAttributes.RESOURCE_URI, uri);

      try {
        const result = await this.resources.readResource(uri);

        if (!result) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: `Resource not found: "${uri}"` });
          return {
            contents: [{ uri, mimeType: 'text/plain', text: `Resource not found: "${uri}"` }],
          };
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return {
          contents: [
            {
              uri: result.uri,
              mimeType: result.mimeType,
              ...(result.content.type === 'text'
                ? { text: result.content.text }
                : { blob: result.content.blob }),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ── Prompts ──────────────────────────────────────────────────────────────

  private handleListPrompts(): { prompts: ReturnType<PromptRegistry['listPrompts']> } {
    return { prompts: this.prompts.listPrompts() };
  }

  private async handleGetPrompt(request: {
    params: { name: string; arguments?: Record<string, string> };
  }): Promise<{ description: string; messages: unknown[] } | { error: string }> {
    const { name, arguments: args = {} } = request.params;
    const tracer = getTracer();

    return tracer.startActiveSpan('mcp.prompt.get', async (span) => {
      span.setAttribute(SpanAttributes.PROMPT_NAME, name);

      try {
        const result = await this.prompts.getPrompt(name, args);

        if (!result) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: `Prompt not found: "${name}"` });
          span.end();
          return { error: `Prompt not found: "${name}"` };
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ── Context & helpers ────────────────────────────────────────────────────

  /**
   * Build a RequestContext for the current call.
   * Uses incoming context from HTTP transport if available (headers, trace ID, JWT).
   * For stdio transport, generates a new trace ID and uses empty headers.
   */
  private buildContext(rawHeaders: Record<string, string> = {}): RequestContext {
    if (this.incomingContext) {
      return {
        traceId: this.incomingContext.traceId,
        rawHeaders: this.incomingContext.rawHeaders,
        forwardedHeaders: this.filterHeaders(this.incomingContext.rawHeaders),
        jwt: this.incomingContext.jwt,
      };
    }

    return {
      traceId: randomUUID().replace(/-/g, ''),
      rawHeaders,
      forwardedHeaders: this.filterHeaders(rawHeaders),
      jwt: undefined,
    };
  }

  private filterHeaders(rawHeaders: Record<string, string>): Record<string, string> {
    const allowed = this.config.forward_headers ?? [];
    const filtered: Record<string, string> = {};
    for (const name of allowed) {
      const value = rawHeaders[name.toLowerCase()];
      if (value !== undefined) filtered[name.toLowerCase()] = value;
    }
    return filtered;
  }

  private errorResponse(text: string): {
    content: Array<{ type: string; text: string }>;
    isError: boolean;
  } {
    return { content: [{ type: 'text', text }], isError: true };
  }
}

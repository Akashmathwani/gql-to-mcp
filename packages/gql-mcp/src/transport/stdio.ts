import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * stdio transport — connects an MCP Server instance to stdin/stdout.
 *
 * Used when the server is spawned as a subprocess by a client
 * (Claude Desktop, MCP Inspector CLI, LangGraph local dev).
 *
 * No auth, no headers, no CORS — stdio is always a trusted local process.
 * RequestContext for stdio calls will have empty rawHeaders and no jwt.
 */

export interface StdioTransportHandle {
  close(): Promise<void>;
}

/**
 * Connect a pre-configured MCP Server instance to the stdio transport.
 * Resolves once the transport is connected and ready to receive messages.
 */
export async function createStdioTransport(instance: Server): Promise<StdioTransportHandle> {
  const transport = new StdioServerTransport();
  await instance.connect(transport);

  return {
    close: async () => {
      await instance.close();
    },
  };
}

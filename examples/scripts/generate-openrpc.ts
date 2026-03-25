// scripts/generate-openrpc.ts
import { createMcpServer } from 'gql-to-mcp';
import { customTools } from '../tools';
import { writeFileSync } from 'fs';

function main() {
  const server = createMcpServer({
    config: './mcp-config.yaml',
    tools: customTools,
  });

  const tools = server.listTools(); // ToolManifestEntry[]

  const openrpc = {
    openrpc: '1.2.1',
    info: {
      title: 'gql-mcp',
      version: '1.0.0',
    },
    methods: tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      params: tool.inputSchema?.properties
        ? Object.entries(tool.inputSchema.properties).map(([k, v]) => ({
            name: k,
            required: (tool.inputSchema.required ?? []).includes(k),
            schema: v,
          }))
        : [],
      result: {
        name: 'result',
        schema: { type: 'object' },
      },
    })),
  };

  writeFileSync('./openrpc.json', JSON.stringify(openrpc, null, 2));

  console.log(`✅ openrpc.json — ${tools.length} tools`);
  console.log(tools.map((t) => `   • ${t.name}  [${t.authMode}]`).join('\n'));
}

main();

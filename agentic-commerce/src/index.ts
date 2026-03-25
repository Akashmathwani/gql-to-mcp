import 'dotenv/config';
import { createMcpServer } from 'gql-to-mcp';
import { allTools } from './tools/index';

const server = createMcpServer({
  config: './mcp-config.yaml',
  tools: allTools,
});

server.start().catch((err: unknown) => {
  process.stderr.write(`Server failed to start: ${String(err)}\n`);
  process.exit(1);
});

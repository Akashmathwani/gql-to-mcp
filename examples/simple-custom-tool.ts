#!/usr/bin/env node
/**
 * Example: MCP Server with .graphql operations + custom tools
 *
 * This will load:
 * - All .graphql files from ./operations (searchProduct, getProduct, etc.)
 * - Plus custom tools from ./tools directory
 *
 * Run with: npm run simple-custom
 */

import { createMcpServer } from 'gql-to-mcp';
import { customTools } from './tools';

const server = createMcpServer({
  config: './mcp-config.yaml',

  // Import all custom tools from the tools directory
  tools: customTools,
});

console.log('🚀 Starting MCP server...');
console.log('   - Loading all .graphql operations from ./operations');
console.log(`   - Plus ${customTools.length} custom tools from ./tools`);

server.start().then(() => {
  console.log('✅ Server running!');
  console.log('   Test at: http://localhost:3000');
});

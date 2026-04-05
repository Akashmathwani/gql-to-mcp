# gql-mcp

> Convert GraphQL operations into MCP tools with support for custom multi-step workflows

## Overview

`gql-mcp` is a TypeScript library that turns your GraphQL operations into MCP (Model Context Protocol) tools. It auto-discovers `.graphql` files and exposes them as tools, with support for custom tools that chain multiple GraphQL calls.

## Installation

```bash
npm install gql-to-mcp
```

## Quick Start

```typescript
import { createMcpServer } from 'gql-to-mcp';

const server = createMcpServer({
  config: './mcp-config.yaml',
  tools: [], // optional custom tools
});

await server.start();
```

## Configuration

Create a `mcp-config.yaml` file:

```yaml
server_info:
  name: my-mcp-server
  version: 1.0.0

endpoint: 'https://api.example.com/graphql'

headers:
  x-client-name: my-app

# Optional: Auto-discover GraphQL operations
schema:
  source: local
  path: ./schema.graphql

operations:
  dirs:
    - ./operations

# Optional: Logging
logging:
  level: info # debug | info | warn | error
  format: json # json | pretty
  redact:
    - headers.authorization
    - jwt.sub

# Optional: Telemetry (New Relic, Splunk, etc)
telemetry:
  enabled: true
  service_name: my-service
  exporters:
    tracing:
      otlp:
        endpoint: ${env.OTLP_ENDPOINT}
        headers:
          api-key: ${env.LICENSE_KEY}
```

## Custom Tools

Create multi-step tools that chain GraphQL operations:

```typescript
import { CustomTool } from 'gql-to-mcp';

const myTool: CustomTool = {
  name: 'my_custom_tool',
  description: 'Does something complex',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
    required: ['id'],
  },
  execute: async (args, ctx) => {
    // Call GraphQL
    const result = await ctx.gql(
      `
      query GetData($id: ID!) {
        item(id: $id) { id name }
      }
    `,
      { id: args.id }
    );

    return result.data;
  },
};

export default myTool;
```

## Features

- ✅ Auto-converts `.graphql` files to MCP tools
- ✅ Schema validation at startup
- ✅ Custom multi-step tools
- ✅ Auth header forwarding
- ✅ Structured logging (Pino)
- ✅ OpenTelemetry tracing
- ✅ TypeScript support

## Development

```bash
# Build
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

## Contributing

Open an issue or pull request on GitHub for bug reports, feature requests, or any proposed changes.

## License

MIT

# Tesco Agentic Commerce MCP Server

> MCP server implementation for Tesco commerce using UCP (Universal Commerce Protocol)

## Overview

This is a Tesco-specific MCP server that provides custom tools for shopping operations:

- Product search and lookup
- Basket management
- Checkout workflows

Built using the `gql-to-mcp` framework with custom UCP tools.

## Prerequisites

- Node.js >= 18
- npm >= 9

## Setup

1. **Build the gql-mcp package first**

   ```bash

   # From the root of the monorepo

   cd packages/gql-mcp

   npm install

   npm run build

   cd ../..

   ```

2. **Install dependencies**

   ```bash

   cd agentic-commerce

   npm install

   ```

3. **Configure environment**

   Create a `.env` file (or configure directly in `mcp-config.yaml`):

   ```env

   GRAPHQL_ENDPOINT=https://your-graphql-endpoint.com/graphql

   NEW_RELIC_OTLP_ENDPOINT=https://otlp.eu01.nr-data.net

   NEW_RELIC_LICENSE_KEY=your_license_key_here

   ```

   **Note**: The config uses `${env.GRAPHQL_ENDPOINT}` syntax in `mcp-config.yaml`, which reads from environment variables. You can either:
   - Set in `.env` file (recommended for local dev)

   - Set as environment variables directly

   - Replace `${env.GRAPHQL_ENDPOINT}` with the actual URL in `mcp-config.yaml`

4. **Build**

   ```bash

   npm run build

   ```

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

The server will start on `http://localhost:3000` with:

- MCP endpoint: `http://localhost:3000/mcp`
- Health check: `http://localhost:3000/health`

## Configuration

Edit `mcp-config.yaml` to customize server behavior.

**Key settings:**
- **Logging**: Set `level` (debug/info/warn/error) and `format` (json/pretty)
- **Telemetry**: Configure New Relic OTLP endpoint
- **Transport**: Change port or address
- **Headers**: Modify forwarded headers

📖 **[View detailed configuration guide](./docs/configuration.md)** - Complete reference for all config options

## Available Tools

The server provides custom UCP tools for:

- `search_catalog` - Search products
- `lookup_catalog` - Get product details
- `create_checkout` - Create basket/checkout
- `update_checkout` - Update basket items
- `get_checkout` - Get current basket

## Monitoring

### Logs

- **Format**: JSON structured logs (use `format: pretty` for development)
- **Output**: stderr
- **Redaction**: Sensitive fields like `authorization` headers are automatically redacted

### Traces (APM)

- Distributed traces sent to New Relic via OTLP
- View spans for tool executions and GraphQL requests
- Service name: `tesco-xapi-mcp`

### Health Check

```bash
curl http://localhost:3000/health
```

## Project Structure

```
agentic-commerce/
├── src/
│   ├── index.ts           # Server entry point
│   ├── tools/
│   │   ├── index.ts       # Tool exports
│   │   └── ucp/           # UCP custom tools
│   │       ├── catalog/   # Search and browse tools
│   │       ├── lookup/    # Product lookup tool
│   │       └── checkout/  # Basket/checkout tools
│   ├── types/             # TypeScript type definitions
│   ├── graphql/           # GraphQL queries/mutations
│   ├── resources/         # MCP resources
│   └── prompts/           # MCP prompts
├── docs/                  # Documentation
├── mcp-config.yaml        # MCP server configuration
├── .env                   # Environment variables (not committed)
├── package.json
└── tsconfig.json
```

## Troubleshooting

**Logs not appearing?**

- Check `logging.level` in `mcp-config.yaml`
- Use `format: pretty` for development
- Logs go to stderr (not stdout)

**New Relic not receiving data?**

- Verify `NEW_RELIC_LICENSE_KEY` is set
- Check `NEW_RELIC_OTLP_ENDPOINT` is correct
- Ensure `telemetry.enabled: true` in config

**Server won't start?**

- Check all environment variables are set
- Verify GraphQL endpoint is accessible
- Review startup errors in stderr

## License

MIT

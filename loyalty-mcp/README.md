# Loyalty MCP Server

> MCP server implementation for customer loyalty operations using gql-to-mcp

## Overview

This is a loyalty-focused MCP server that provides tools for managing customer loyalty programs:

- **Points Management** - Balance checks, transaction history, tier status
- **Rewards Catalog** - Browse and search available rewards
- **Redemption** - Redeem rewards using loyalty points

Built using the `gql-to-mcp` framework with custom loyalty tools.

## Prerequisites

- Node.js >= 18
- npm >= 9
- Access to loyalty GraphQL endpoint

## Setup

### 1. Build the gql-mcp package first

```bash
# From the root of the monorepo
cd packages/gql-mcp
npm install
npm run build
cd ../..
```

### 2. Install dependencies

```bash
cd loyalty-mcp
npm install
```

### 3. Configure environment

Create a `.env` file:

```env
# Loyalty GraphQL endpoint
GRAPHQL_ENDPOINT=https://your-loyalty-graphql-endpoint.com/graphql

# API Key
X_API_KEY=your_api_key_here

# New Relic Observability
NEW_RELIC_OTLP_ENDPOINT=https://otlp.nr-data.net:4317
NEW_RELIC_LICENSE_KEY=your_license_key_here
```

**Important**: Update the GraphQL endpoint to point to your actual loyalty service endpoint.

### 4. Build

```bash
npm run build
```

## Running the Server

### Development (with hot reload)

```bash
npm run dev:watch
```

### Production

```bash
npm start
```

The server will start on `http://localhost:6275` with:

- **MCP endpoint**: `http://localhost:6275/mcp`
- **Health check**: `http://localhost:6275/health`

## Available Tools

The server provides the following loyalty tools:

### Points Tools (JWT Required)

#### `get_points_balance`
Get the current loyalty points balance for a customer.

```json
{
  "customerId": "CUST123"
}
```

Returns: balance, pending points, tier, expiry information

#### `get_points_transactions`
Get points transaction history for a customer.

```json
{
  "customerId": "CUST123",
  "limit": 20,
  "offset": 0
}
```

Returns: list of point earnings, redemptions, expirations with pagination

#### `get_tier_status`
Get loyalty tier status and benefits.

```json
{
  "customerId": "CUST123"
}
```

Returns: current tier, next tier, points to upgrade, benefits

### Rewards Tools (Anonymous)

#### `list_rewards`
List available loyalty rewards.

```json
{
  "category": "vouchers",
  "limit": 20,
  "offset": 0
}
```

Returns: paginated list of rewards with details and point costs

### Redemption Tools (JWT Required)

#### `redeem_reward`
Redeem a reward using customer points.

```json
{
  "customerId": "CUST123",
  "rewardId": "REWARD456",
  "quantity": 1
}
```

Returns: redemption details including voucher code

## GraphQL Integration

This server expects a loyalty GraphQL endpoint with the following capabilities:

### Queries Expected

- `loyalty.customer(id: ID!)` - Get customer loyalty info
- `loyalty.rewards(category: String, limit: Int, offset: Int)` - List rewards

### Mutations Expected

- `loyalty.redeemReward(input: RedemptionInput!)` - Redeem a reward

**Note**: The GraphQL queries in the tools are examples. Update them to match your actual GraphQL schema.

## Configuration

Edit `mcp-config.yaml` to customize server behavior:

### Key Settings

- **Port**: Default `6275` (different from agentic-commerce `6274`)
- **Logging**: Set `level` (debug/info/warn/error) and `format` (json/pretty)
- **Telemetry**: Configure New Relic OTLP endpoint
- **Auth**: Enable JWT authentication for production
- **Headers**: Forward customer context headers

### Header Forwarding

The server forwards these headers to GraphQL:

- `authorization` - JWT token
- `x-tesco-uid` - User ID
- `x-customer-id` - Customer ID
- `x-api-key` - API key
- Tracing headers (traceparent, tracestate, traceId)

## Authentication

### Development (Auth Disabled)

By default, auth is disabled for local development. JWT-protected tools will work without authentication.

### Production (Auth Enabled)

Uncomment the `auth` section in `mcp-config.yaml`:

```yaml
auth:
  enabled: true
  issuers:
    - https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/v2.0
  audience: ${env.API_AUDIENCE}
  allow_anonymous_tools:
    - list_rewards  # Public rewards catalog
```

## Project Structure

```
loyalty-mcp/
├── src/
│   ├── index.ts              # Server entry point
│   ├── tools/
│   │   ├── index.ts          # Export all tools
│   │   └── loyalty/
│   │       ├── points/       # Points tools
│   │       │   ├── get-balance.ts
│   │       │   ├── get-transactions.ts
│   │       │   └── get-tier-status.ts
│   │       ├── rewards/      # Rewards tools
│   │       │   └── list-rewards.ts
│   │       └── redemption/   # Redemption tools
│   │           └── redeem-reward.ts
│   └── types/
│       └── loyalty.ts        # TypeScript types
├── mcp-config.yaml           # MCP server config
├── .env                      # Environment variables
├── package.json
└── tsconfig.json
```

## Monitoring

### Logs

- **Format**: JSON structured logs (use `format: pretty` for development)
- **Output**: stderr
- **Redaction**: Sensitive fields automatically redacted:
  - `headers.authorization`
  - `jwt.sub`
  - `customer.email`
  - `customer.phone`

### Traces (APM)

- Distributed traces sent to New Relic via OTLP
- View tool executions and GraphQL request spans
- Service name: `loyalty-mcp`

### Health Check

```bash
curl http://localhost:6275/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Customization

### Adding New Tools

1. Create a new tool file in `src/tools/loyalty/[category]/`
2. Define your tool with `CustomTool` interface
3. Export from `src/tools/index.ts`
4. Update README with tool documentation

Example:

```typescript
import { z } from 'zod';
import type { CustomTool } from 'gql-to-mcp';

const InputSchema = z.object({
  customerId: z.string(),
});

export const myNewTool: CustomTool = {
  name: 'my_new_tool',
  authMode: 'jwt',
  description: 'Does something awesome',
  inputSchema: InputSchema,
  
  async execute(args, ctx) {
    const result = await ctx.gql(QUERY, args);
    return result.data;
  },
};
```

### GraphQL Code Generation

To generate TypeScript types from your GraphQL schema:

1. Create `codegen.yml`:

```yaml
schema: ${GRAPHQL_ENDPOINT}
documents: 'src/**/*.graphql'
generates:
  src/types/generated.ts:
    plugins:
      - typescript
      - typescript-operations
```

2. Run codegen:

```bash
npm run codegen
```

## Testing

### Local Testing with MCP Inspector

1. Start the server: `npm run dev`
2. Open MCP Inspector: `http://localhost:6275`
3. Test tools with sample inputs

### Integration Testing

```bash
# Test health endpoint
curl http://localhost:6275/health

# Test MCP endpoint (requires MCP client)
curl http://localhost:6275/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'
```

## Troubleshooting

**Server won't start?**
- ✓ Check `.env` file exists and has correct values
- ✓ Verify GraphQL endpoint is accessible
- ✓ Ensure gql-mcp package is built: `cd ../packages/gql-mcp && npm run build`
- ✓ Check logs in stderr

**GraphQL errors?**
- ✓ Verify endpoint URL in `.env`
- ✓ Check API key is valid
- ✓ Update queries to match your actual GraphQL schema
- ✓ Enable debug logging: `logging.level: debug` in config

**No logs appearing?**
- ✓ Logs go to stderr (not stdout)
- ✓ Use `format: pretty` for readable development logs
- ✓ Check `logging.level` in `mcp-config.yaml`

**New Relic not receiving data?**
- ✓ Verify `NEW_RELIC_LICENSE_KEY` is set
- ✓ Check `NEW_RELIC_OTLP_ENDPOINT` is correct
- ✓ Ensure `telemetry.enabled: true` in config

## Contributing

When adding new tools:

1. Follow the existing tool structure
2. Use Zod for input validation
3. Add proper TypeScript types
4. Document the tool in this README
5. Test with MCP Inspector

## License

MIT

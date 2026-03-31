# Loyalty MCP Architecture

## Overview

The loyalty-mcp server is built on the `gql-to-mcp` framework, which converts GraphQL operations into MCP (Model Context Protocol) tools that can be consumed by AI agents and applications.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Agent / Client                        │
└────────────────────┬────────────────────────────────────────┘
                     │ MCP Protocol (HTTP/stdio)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Loyalty MCP Server                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MCP Server Layer                        │   │
│  │  - Request routing                                   │   │
│  │  - Tool registry                                     │   │
│  │  - Auth & validation                                 │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │              Custom Tools Layer                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │ Points   │  │ Rewards  │  │  Redemption      │   │   │
│  │  │ Tools    │  │ Tools    │  │  Tools           │   │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │              GraphQL Client                          │   │
│  │  - Query execution                                   │   │
│  │  - Header forwarding                                 │   │
│  │  - Error handling                                    │   │
│  └────────────────────┬─────────────────────────────────┘   │
└───────────────────────┼──────────────────────────────────────┘
                        │ GraphQL
                        │
┌───────────────────────▼──────────────────────────────────────┐
│              Loyalty GraphQL API                             │
│  - Points management                                         │
│  - Rewards catalog                                           │
│  - Redemption processing                                     │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. MCP Server Layer (gql-to-mcp)

**Responsibilities:**
- Handle MCP protocol requests (HTTP or stdio)
- Route tool calls to appropriate handlers
- Manage authentication and authorization
- Provide observability (logging, tracing)

**Key Features:**
- JWT authentication support
- Header forwarding
- CORS configuration
- Health check endpoint
- OpenTelemetry integration

### 2. Custom Tools Layer

**Structure:**
```
src/tools/
├── index.ts                    # Tool registry
└── loyalty/
    ├── points/                 # Points operations
    │   ├── get-balance.ts
    │   ├── get-transactions.ts
    │   └── get-tier-status.ts
    ├── rewards/                # Rewards operations
    │   └── list-rewards.ts
    └── redemption/             # Redemption operations
        └── redeem-reward.ts
```

**Tool Anatomy:**
```typescript
export const toolName: CustomTool = {
  name: 'tool_name',           // Unique identifier
  authMode: 'jwt' | 'anonymous', // Auth requirement
  description: '...',          // Tool documentation
  inputSchema: ZodSchema,      // Input validation
  
  async execute(args, ctx) {  // Tool implementation
    // 1. Validate input (automatic via Zod)
    // 2. Execute GraphQL query/mutation
    // 3. Transform response
    // 4. Return formatted data
  }
};
```

### 3. GraphQL Client Layer

**Responsibilities:**
- Execute GraphQL queries and mutations
- Forward authentication headers
- Handle network errors
- Retry logic (optional)

**Headers Forwarded:**
- `authorization` - JWT token
- `x-tesco-uid` - User identifier
- `x-customer-id` - Customer identifier
- `x-api-key` - API key
- Tracing headers (traceparent, tracestate)

## Data Flow

### Example: Get Points Balance

```
1. AI Agent Request
   ↓
   POST /mcp
   {
     "method": "tools/call",
     "params": {
       "name": "get_points_balance",
       "arguments": { "customerId": "CUST123" }
     }
   }

2. MCP Server
   ↓
   - Validates request
   - Checks auth (JWT)
   - Routes to tool handler

3. Tool Handler (get-balance.ts)
   ↓
   - Validates input with Zod
   - Prepares GraphQL query
   - Calls ctx.gql()

4. GraphQL Client
   ↓
   - Adds headers (auth, api-key)
   - Executes HTTP POST to GraphQL endpoint
   - Returns response

5. Tool Handler
   ↓
   - Transforms GraphQL response
   - Formats for MCP
   - Returns to MCP server

6. MCP Server Response
   ↓
   {
     "result": {
       "customerId": "CUST123",
       "balance": 5000,
       "pending": 250,
       "tier": "GOLD"
     }
   }
```

## Authentication Flow

### Development (Auth Disabled)

```
Client → MCP Server → GraphQL API
         (no auth check)
```

### Production (Auth Enabled)

```
Client → MCP Server → Verify JWT → GraphQL API
         │            │
         │            └─ Extract claims
         │            └─ Check scopes
         │            └─ Forward token
         │
         └─ Reject if invalid
```

**JWT Claims Expected:**
```json
{
  "sub": "user-123",
  "aud": "loyalty-api",
  "scope": "loyalty:read loyalty:write",
  "customer_id": "CUST123"
}
```

## Tool Authorization Matrix

| Tool                    | Auth Mode | Required Scope      |
|------------------------|-----------|---------------------|
| get_points_balance     | jwt       | loyalty:read        |
| get_points_transactions| jwt       | loyalty:read        |
| get_tier_status        | jwt       | loyalty:read        |
| list_rewards           | anonymous | -                   |
| redeem_reward          | jwt       | loyalty:write       |

## Configuration

### Transport Options

**1. HTTP (streamable_http)**
- Best for web applications
- Supports CORS
- Enables MCP Inspector
- Port: 6275 (configurable)

**2. stdio**
- Best for CLI tools
- Used by desktop applications (Claude Desktop)
- Lower overhead

### Telemetry

**Logging:**
- **Format**: JSON or pretty
- **Levels**: debug, info, warn, error
- **Output**: stderr
- **Redaction**: Automatic PII removal

**Tracing:**
- **Protocol**: OpenTelemetry (OTLP)
- **Spans**: Tool executions, GraphQL calls
- **Backend**: New Relic (configurable)

## Error Handling

### Error Types

1. **Validation Errors** (4xx)
   - Invalid input
   - Missing required fields
   - Type mismatches

2. **Authentication Errors** (401)
   - Missing JWT
   - Invalid JWT
   - Expired JWT

3. **Authorization Errors** (403)
   - Insufficient scopes
   - Wrong customer context

4. **GraphQL Errors** (varies)
   - Network failures
   - Query errors
   - Business logic errors

5. **Server Errors** (5xx)
   - Uncaught exceptions
   - GraphQL API down

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

## Performance Considerations

### Response Times

- **Tool validation**: < 1ms (Zod)
- **GraphQL call**: 50-200ms (network + processing)
- **Response formatting**: < 5ms
- **Total**: ~60-210ms typical

### Optimization Strategies

1. **Query optimization**
   - Request only needed fields
   - Use pagination
   - Add DataLoader for batching (future)

2. **Caching**
   - Cache rewards catalog (low change rate)
   - Cache tier benefits
   - TTL: 5-60 minutes

3. **Connection pooling**
   - Reuse HTTP connections
   - Configurable pool size

## Security

### Best Practices

1. **Never log sensitive data**
   - Redact authorization headers
   - Redact customer PII
   - Redact voucher codes

2. **Validate all inputs**
   - Use Zod schemas
   - Reject unexpected fields
   - Sanitize string inputs

3. **Use HTTPS in production**
   - Enforce TLS 1.2+
   - Validate certificates

4. **Implement rate limiting**
   - Per-customer limits
   - Per-tool limits
   - Global rate limits

5. **Audit logging**
   - Log all redemptions
   - Log auth failures
   - Log suspicious activity

## Monitoring

### Key Metrics

1. **Tool Calls**
   - Requests per second
   - Error rate by tool
   - Latency percentiles (p50, p95, p99)

2. **GraphQL Performance**
   - Query duration
   - Error rate
   - Timeout rate

3. **Business Metrics**
   - Points redeemed
   - Rewards issued
   - Failed redemptions

### Alerts

- **Critical**: Error rate > 5%
- **Warning**: Latency p95 > 500ms
- **Info**: New tool deployed

## Scalability

### Horizontal Scaling

- Stateless design
- No in-memory state
- Can run multiple instances
- Load balancer friendly

### Vertical Scaling

- CPU-bound: Query parsing
- Memory-bound: Large responses
- I/O-bound: GraphQL calls

### Limits

- Max request size: 10MB
- Max response size: 100MB
- Request timeout: 30s
- Max concurrent requests: 100

## Future Enhancements

1. **Caching Layer**
   - Redis for rewards catalog
   - Customer tier caching

2. **Real-time Updates**
   - GraphQL subscriptions
   - WebSocket support

3. **Batch Operations**
   - DataLoader integration
   - Bulk redemptions

4. **Enhanced Analytics**
   - Customer journey tracking
   - A/B testing support

5. **Multi-tenant Support**
   - Region-specific configs
   - Brand-specific catalogs

# Configuration Guide

This document explains the `mcp-config.yaml` configuration structure and how to control the MCP server behavior.

## Overview

The `mcp-config.yaml` file controls all aspects of the MCP server including:

- Server information
- GraphQL endpoint
- HTTP transport settings
- Logging configuration
- Telemetry/observability
- Header forwarding
- Authentication (optional)

## Configuration File Location

By default, the server looks for `mcp-config.yaml` in the project root. You can specify a different location:

```typescript
createMcpServer({
  config: './path/to/custom-config.yaml',
});
```

## Environment Variable Interpolation

The config supports environment variable substitution using `${env.VARIABLE_NAME}` syntax:

```yaml
endpoint: '${env.GRAPHQL_ENDPOINT}'
```

**How it works:**

1. Reads from `.env` file (if using `dotenv`)
2. Falls back to system environment variables
3. Throws error if variable is not set

**Example:**

```yaml
# In mcp-config.yaml
endpoint: '${env.GRAPHQL_ENDPOINT}'

# In .env file
GRAPHQL_ENDPOINT=https://api.example.com/graphql
```

## Configuration Sections

### 1. Server Information

```yaml
server_info:
  name: agentic-commerce-mcp
  version: 0.1.0
  title: Tesco Commerce MCP Server (UCP)
```

- **name**: Server identifier (shown in MCP protocol)
- **version**: Server version
- **title**: Human-readable description

### 2. GraphQL Endpoint

```yaml
endpoint: '${env.GRAPHQL_ENDPOINT}'
```

The GraphQL API endpoint that all operations will be sent to.

**Options:**

- Use env var: `'${env.GRAPHQL_ENDPOINT}'` (recommended)
- Hardcode: `'https://api.example.com/graphql'`

### 3. Static Headers

```yaml
headers:
  x-client-name: agentic-commerce-mcp
  x-api-version: v1
```

Headers sent with **every** GraphQL request. Useful for:

- Client identification
- API versioning
- Static authentication tokens (not recommended for sensitive tokens)

### 4. Header Forwarding

```yaml
forward_headers:
  - authorization
  - x-tesco-uid
  - x-tesco-store-id
  - traceparent
  - tracestate
  - traceId
```

Headers to forward from incoming MCP requests to GraphQL endpoint.

**Use cases:**

- **authorization**: Pass user JWT tokens
- **x-tesco-uid**: User identification
- **traceparent/tracestate**: Distributed tracing propagation
- Custom headers for region, language, tenant, etc.

**Security:** Only listed headers are forwarded; all others are dropped.

### 5. Transport Configuration

```yaml
transport:
  type: streamable_http # or 'stdio'
  port: 3000
  address: localhost # or '0.0.0.0' for all interfaces

  cors:
    origins:
      - http://localhost:6274 # MCP Inspector
      - https://your-frontend.com
```

**Transport Types:**

#### `streamable_http` (Recommended)

- HTTP-based MCP server
- Supports CORS
- Easy to test with MCP Inspector
- Production-ready with load balancers

#### `stdio`

- Standard input/output transport
- Used for local CLI tools
- No HTTP server needed

**CORS Configuration:**

```yaml
cors:
  origins:
    - http://localhost:6274 # Development
    - https://app.example.com # Production
  credentials: true # Optional: allow credentials
```

### 6. Authentication (Optional)

```yaml
transport:
  auth:
    enabled: true
    issuers:
      - https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/v2.0
    audience: ${env.API_AUDIENCE}
    allow_anonymous_tools:
      - search_catalog
      - lookup_catalog
```

**JWT Validation:**

- **enabled**: Turn on/off JWT validation
- **issuers**: Trusted JWT issuers (supports multiple)
- **audience**: Expected JWT audience claim
- **allow_anonymous_tools**: Tools that don't require authentication

**Example JWT flow:**

1. Client sends request with `Authorization: Bearer <token>`
2. Server validates token against issuer's JWKS
3. If valid, forwards to GraphQL endpoint
4. If invalid, returns 401 error

### 7. Schema & Operations (Optional)

```yaml
schema:
  source: local
  path: ./schema.graphql

operations:
  dirs:
    - ./operations
```

Use these if you want **auto-generated tools** from `.graphql` files.

**Disabled by default** in agentic-commerce (uses custom tools only).

### 8. Logging

```yaml
logging:
  level: debug # debug | info | warn | error
  format: pretty # json | pretty
  redact:
    - headers.authorization
    - jwt.sub
```

**Log Levels:**

- **debug**: Verbose, shows all operations (development)
- **info**: Normal operations, tool executions (production)
- **warn**: Warnings and errors only
- **error**: Errors only

**Log Formats:**

- **json**: Structured JSON logs (production, New Relic ingestion)
- **pretty**: Colored, human-readable (development)

**Redaction:**
Automatically censor sensitive fields in logs:

```yaml
redact:
  - headers.authorization # Removes auth tokens from logs
  - jwt.sub # Removes user IDs
  - args.password # Custom field redaction
```

**Output:** All logs go to **stderr** (stdout is reserved for MCP protocol).

### 9. Telemetry (Observability)

```yaml
telemetry:
  enabled: true
  service_name: tesco-xapi-mcp
  service_version: 1.0.0
  exporters:
    tracing:
      otlp:
        endpoint: ${env.NEW_RELIC_OTLP_ENDPOINT}
        headers:
          api-key: ${env.NEW_RELIC_LICENSE_KEY}
```

**Distributed Tracing:**

- Sends traces to New Relic, Splunk, or any OTLP-compatible backend
- Auto-instruments HTTP calls
- Creates spans for tool executions

**Span Names:**

- `mcp.tool.execute` - Tool call
- `mcp.resource.read` - Resource read
- `mcp.prompt.get` - Prompt fetch
- `gql.request` - GraphQL HTTP request

**Disable telemetry:**

```yaml
telemetry:
  enabled: false
```

### 10. Health Check

```yaml
health_check:
  enabled: true
  path: /health
```

Exposes a health check endpoint (HTTP transport only):

```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

## Common Configuration Patterns

### Development Setup

```yaml
logging:
  level: debug
  format: pretty

transport:
  type: streamable_http
  port: 3000
  address: localhost

telemetry:
  enabled: false # Optional: disable for faster startup
```

### Production Setup

```yaml
logging:
  level: info
  format: json
  redact:
    - headers.authorization
    - jwt.sub

transport:
  type: streamable_http
  port: 8080
  address: 0.0.0.0
  auth:
    enabled: true
    issuers:
      - https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/v2.0
    audience: ${env.API_AUDIENCE}

telemetry:
  enabled: true
  service_name: tesco-commerce-mcp-prod
  exporters:
    tracing:
      otlp:
        endpoint: ${env.NEW_RELIC_OTLP_ENDPOINT}
        headers:
          api-key: ${env.NEW_RELIC_LICENSE_KEY}
```

### Minimal Setup (Custom Tools Only)

```yaml
server_info:
  name: my-mcp-server
  version: 1.0.0

endpoint: '${env.GRAPHQL_ENDPOINT}'

transport:
  type: streamable_http
  port: 3000

logging:
  level: info
  format: json
```

## Environment Variables Reference

Required variables for default config:

```env
# GraphQL Endpoint
GRAPHQL_ENDPOINT=https://your-graphql-api.com/graphql

# New Relic (optional, for telemetry)
NEW_RELIC_OTLP_ENDPOINT=https://otlp.eu01.nr-data.net
NEW_RELIC_LICENSE_KEY=your_license_key_here

# Azure AD (optional, for JWT validation)
AZURE_TENANT_ID=your_tenant_id
API_AUDIENCE=api://your-api-id
```

## Validation

The config is validated at startup. Common errors:

**Missing environment variable:**

```
ConfigError: Environment variable not set: GRAPHQL_ENDPOINT
```

→ Set the variable in `.env` or environment

**Invalid YAML:**

```
YAMLException: bad indentation
```

→ Check YAML syntax (spaces, not tabs)

**Invalid value:**

```
ConfigError: logging.level must be one of: debug, info, warn, error
```

→ Fix the invalid value

## Dynamic Configuration

You can also pass config programmatically:

```typescript
import { createMcpServer } from 'gql-to-mcp';

const server = createMcpServer({
  config: {
    endpoint: 'https://api.example.com/graphql',
    logging: {
      level: 'debug',
      format: 'pretty',
    },
    transport: {
      type: 'streamable_http',
      port: 3000,
    },
  },
});
```

## Best Practices

1. **Use environment variables** for secrets and environment-specific values
2. **Enable redaction** in production to avoid logging sensitive data
3. **Use JSON logs** in production for structured logging
4. **Enable telemetry** for observability in production
5. **Enable JWT validation** in production
6. **Use CORS allowlist** to restrict origins
7. **Version your config** alongside code changes

## Troubleshooting

**Server won't start:**

- Check all `${env.VAR}` references have corresponding values
- Validate YAML syntax
- Check file permissions on config file

**Logs not appearing:**

- Check `logging.level` - may be too restrictive
- Logs go to **stderr**, not stdout
- Use `format: pretty` for easier reading in dev

**Telemetry not working:**

- Verify `telemetry.enabled: true`
- Check New Relic license key is valid
- Verify OTLP endpoint is accessible
- Check network/firewall rules

**CORS errors:**

- Add origin to `transport.cors.origins`
- Ensure origin matches exactly (protocol + domain + port)

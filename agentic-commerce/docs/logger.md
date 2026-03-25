# Logger

Built on [Pino](https://github.com/pinojs/pino). Configured via `mcp-config.yaml` under the `logging` key.

## Config

```yaml
logging:
  level: debug # debug | info | warn | error  (default: info)
  format: pretty # pretty | json | otel          (default: json)
  redact: # optional — dot-path fields to censor
    - headers.authorization
    - jwt.sub
    - args.cardNumber
```

`serviceName` is taken from `server_info.name` in your yaml — no hardcoding needed.

---

## Formats

### `pretty`

Coloured, human-readable output. Use locally only.

```
10:00:21.083 INFO:  MCP server started   { transport: "streamable_http", url: "http://localhost:3000/mcp", tools: 3 }
10:00:25.100 DEBUG: GQL request          { operation: "SearchProducts", attempt: 0 }
10:00:25.138 DEBUG: GQL response         { operation: "SearchProducts", status: 200 }
10:00:25.139 DEBUG: Tool executed successfully
```

```yaml
logging:
  level: debug
  format: pretty
```

---

### `json`

Raw NDJSON to stderr. No external dependencies. Use when you want file-based log scraping (e.g. Splunk forwarder reading stderr) or as a safe fallback.

```json
{"level":30,"time":"2025-01-01T10:00:21.083Z","service":"agentic-commerce-mcp","transport":"streamable_http","msg":"MCP server started"}
{"level":20,"time":"2025-01-01T10:00:25.100Z","service":"agentic-commerce-mcp","operation":"SearchProducts","attempt":0,"msg":"GQL request"}
```

```yaml
logging:
  level: info
  format: json
```

---

### `otel`

Ships logs to New Relic or Splunk via OTLP. Logs are **correlated with traces** — traceId and spanId are injected automatically from the active OTel context. This means you can click a span in NR and see its logs inline.

Requires `setupTelemetry()` to have been called first (happens automatically in `createMcpServer`). Reads the same env vars as traces — no extra config needed.

```yaml
logging:
  level: info
  format: otel
  redact:
    - headers.authorization
    - jwt.sub
```

Required env vars:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.eu01.nr-data.net
OTEL_EXPORTER_OTLP_HEADERS=api-key=<your_license_key>
```

---

## Levels

| Level   | When to use                                                          |
| ------- | -------------------------------------------------------------------- |
| `debug` | GQL request/response, tool execution steps — high volume, local only |
| `info`  | Server startup, tools registered, request received — always on       |
| `warn`  | GQL retry, degraded behaviour, non-fatal issues                      |
| `error` | Tool execution failed, GQL error, unhandled exception                |

---

## Redaction

Uses Pino's native redact — dot-path syntax, applied before any output reaches the transport. The original object is never mutated.

```yaml
redact:
  - headers.authorization # strips Bearer token
  - jwt.sub # strips user identity
  - args.cardNumber # strips payment fields
  - '*.password' # wildcard — any nested password field
```

Redacted fields are replaced with `[REDACTED]` in all outputs including `otel`.

---

## Child loggers

Bind fixed context to a logger for the lifetime of a request or tool call. All log entries from the child automatically include the bound fields.

```typescript
// per tool call — in mcp-server.ts
const reqLog = logger.child({ tool: toolName, traceId: ctx.traceId });
reqLog.debug('Executing tool');
// output: { tool: "search_catalog", traceId: "abc123", msg: "Executing tool" }

// per GQL request — in gql-client.ts
logger.debug('GQL request', { operation: operationName, attempt });
logger.debug('GQL response', { operation: operationName, status: response.status });
```

---

## Environment configs

### Local dev

```yaml
logging:
  level: debug
  format: pretty
```

### AKS / production

```yaml
logging:
  level: info
  format: otel
  redact:
    - headers.authorization
    - jwt.sub
```

### No NR yet / fallback

```yaml
logging:
  level: info
  format: json
```

---

## NR queries (when using `otel` format)

```sql
-- All logs from the service
SELECT * FROM Log
WHERE service.name = 'tesco-xapi-mcp'
SINCE 30 minutes ago

-- Errors only
SELECT message, tool, traceId
FROM Log
WHERE service.name = 'tesco-xapi-mcp'
AND level = 'error'
SINCE 1 hour ago

-- Logs for a specific tool — traceId links to the trace waterfall
SELECT message, level, tool
FROM Log
WHERE service.name = 'tesco-xapi-mcp'
AND tool = 'search_catalog'
SINCE 30 minutes ago

SELECT * FROM Span
WHERE service.name = 'tesco-xapi-mcp'
SINCE 30 minutes ago
LIMIT 20

```

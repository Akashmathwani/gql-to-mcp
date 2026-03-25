# CLAUDE.md — Project Notes for AI Assistants

## UCP Tools — Schema & Validation

### Use `@ucp-js/sdk` schemas for all UCP tools

The `@ucp-js/sdk` package (hoisted to root `node_modules/` via npm workspaces) exports Zod schemas generated from the UCP OpenAPI spec. Always use these for input/output validation in UCP-related tools — do not hand-write schemas for types that already exist in the SDK.

```ts
import { CheckoutCreateRequestSchema, UcpOrderResponseSchema } from '@ucp-js/sdk';
```

The SDK covers: checkout, orders, fulfillment, payments, line items, buyers, payment instruments, token credentials, and more.

### Catalog schemas — NOT in the SDK

**The `@ucp-js/sdk` spec does not include any catalog types.** Catalog schemas (products, SKUs, inventory, pricing, etc.) must be written manually. Create them in:

```
agentic-commerce/src/tools/ucp/catalog/
```

When the official catalog spec becomes available in the SDK, replace the hand-written schemas with the generated ones.

## Repo Structure

This is an **npm workspaces monorepo**. All shared dependencies are hoisted to the root `node_modules/` — this is intentional.

Workspaces:

- `packages/*` — core libraries
- `agentic-commerce` — agentic commerce MCP server
- `examples` — usage examples

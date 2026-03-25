# GraphQL MCP Monorepo

This monorepo contains a GraphQL-to-MCP framework and a Tesco commerce implementation.

## 📦 Packages

### `packages/gql-mcp`

Core library that converts GraphQL operations into MCP tools with support for custom multi-step tools.

- **[View README](./packages/gql-mcp/README.md)**

### `agentic-commerce`

Tesco commerce MCP server implementation using gql-mcp with UCP (Universal Commerce Protocol) tools.

- **[View README](./agentic-commerce/README.md)**

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build
```

## 📁 Repository Structure

```
gql-mcp/
├── packages/
│   └── gql-mcp/          # Core MCP framework library
├── agentic-commerce/      # Tesco commerce implementation
└── examples/              # Example implementations
```

## License

MIT

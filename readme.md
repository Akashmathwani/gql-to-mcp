# GraphQL MCP Monorepo

This monorepo contains a GraphQL-to-MCP framework , managed with [Lerna](https://lerna.js.org/).

## 📦 Packages

### `packages/gql-mcp`

Core library that converts GraphQL operations into MCP tools with support for custom multi-step tools.

- **[View README](./packages/gql-mcp/README.md)**


### `examples`

Example implementations and usage patterns for gql-mcp.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run both servers in parallel
```

## 🛠️ Common Commands

### Build Commands
```bash
npm run build              # Build all packages
npm run build:packages     # Build only gql-to-mcp
npm run build:servers      # Build only servers
```

### Utility Commands
```bash
npm run clean              # Clean all build artifacts
npm run lint               # Lint all packages
npm run format             # Format all code
npm run type-check         # Type check all packages
```

## 📁 Repository Structure

```
example-mcp/
├── packages/
│   └── gql-mcp/           # Core MCP framework library
├── examples/              # Example implementations
├── lerna.json             # Lerna configuration
└── package.json           # Root workspace configuration
```

## 📚 Documentation

- **[Lerna Guide](./LERNA-GUIDE.md)** - Complete Lerna reference
- **[Quick Start](./QUICK-START.md)** - Quick start commands
- **[Setup](./SETUP.md)** - Detailed setup instructions

## 🔧 Requirements

- Node.js >= 18.19.0 or >= 20.6.0 (Node 20.x recommended)
- npm >= 9.0.0

## License

MIT

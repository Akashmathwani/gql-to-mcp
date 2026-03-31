# GraphQL MCP Monorepo

This monorepo contains a GraphQL-to-MCP framework and Tesco commerce implementations, managed with [Lerna](https://lerna.js.org/).

## 📦 Packages

### `packages/gql-mcp`

Core library that converts GraphQL operations into MCP tools with support for custom multi-step tools.

- **[View README](./packages/gql-mcp/README.md)**

### `agentic-commerce`

Tesco commerce MCP server implementation using gql-mcp with UCP (Universal Commerce Protocol) tools.

- **[View README](./agentic-commerce/README.md)**
- **Port:** http://localhost:6274

### `loyalty-mcp`

Tesco loyalty MCP server for managing coupons, vouchers, and loyalty schemes.

- **Port:** http://localhost:6275

### `examples`

Example implementations and usage patterns for gql-mcp.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run both servers in parallel
npm run dev:all

# Or run servers individually:
npm run dev:agentic   # Agentic commerce server
npm run dev:loyalty   # Loyalty server
```

## 🛠️ Common Commands

### Build Commands
```bash
npm run build              # Build all packages
npm run build:packages     # Build only gql-to-mcp
npm run build:servers      # Build only servers
```

### Development Commands
```bash
npm run dev:agentic        # Run agentic-commerce in dev mode
npm run dev:loyalty        # Run loyalty-mcp in dev mode
npm run dev:all            # Run both servers in parallel
```

### Production Commands
```bash
npm run start:agentic      # Run agentic-commerce in production
npm run start:loyalty      # Run loyalty-mcp in production
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
xapi-mcp/
├── packages/
│   └── gql-mcp/           # Core MCP framework library
├── agentic-commerce/      # Agentic commerce MCP server
├── loyalty-mcp/           # Loyalty MCP server
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

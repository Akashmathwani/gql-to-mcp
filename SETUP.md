# GQL-MCP Project Setup

## Overview

This is a TypeScript monorepo managed with Lerna, containing:

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Lerna** for monorepo management and orchestration
- **npm workspaces** for dependency management

## Packages

- **gql-to-mcp** - Core GraphQL to MCP conversion library
- **agentic-commerce** - Tesco commerce MCP server
- **loyalty-mcp** - Tesco loyalty MCP server
- **gql-mcp-examples** - Example implementations

## Prerequisites

- Node.js >= 18.19.0 or >= 20.6.0 (Node 20.x recommended)
- npm >= 9.0.0

## Installation

Install all dependencies:

```bash
npm install
```

This will install dependencies for all packages in the monorepo.

## Development Workflow

### Building

```bash
# Build all packages in dependency order
npm run build

# Build only the core package
npm run build:packages

# Build only the servers
npm run build:servers

# Build a specific package
npx lerna run build --scope=gql-to-mcp
npx lerna run build --scope=agentic-commerce
npx lerna run build --scope=loyalty-mcp

# Clean build (remove all dist directories)
npm run clean
npm run build
```

### Running Servers

```bash
# Run agentic-commerce server in development
npm run dev:agentic

# Run loyalty-mcp server in development
npm run dev:loyalty

# Run both servers in parallel
npm run dev:all

# Run in production mode
npm run start:agentic
npm run start:loyalty
```

### Linting

```bash
# Lint all packages
npm run lint

# Lint a specific package
npx lerna run lint --scope=gql-to-mcp

# Lint and auto-fix
cd packages/gql-mcp
npm run lint:fix
```

### Formatting

```bash
# Format all files
npm run format

# Check formatting
npm run format:check

# Format specific package
cd packages/gql-mcp
npm run format
```

### Type Checking

```bash
# Type check all packages
npm run type-check

# Type check specific package
cd packages/gql-mcp
npm run type-check
```

### Cleaning

```bash
# Clean all build artifacts
npm run clean

# Clean specific package
cd agentic-commerce
npm run clean
```

## Package Structure

```
xapi-mcp/
├── packages/
│   └── gql-mcp/              # Core library (gql-to-mcp)
│       ├── src/              # TypeScript source files
│       ├── dist/             # Compiled JavaScript (gitignored)
│       ├── package.json
│       └── tsconfig.json
├── agentic-commerce/         # Agentic commerce MCP server
│   ├── src/
│   ├── dist/
│   ├── mcp-config.yaml
│   └── package.json
├── loyalty-mcp/              # Loyalty MCP server
│   ├── src/
│   ├── dist/
│   └── package.json
├── examples/                 # Examples
│   ├── operations/
│   ├── tools/
│   └── package.json
├── lerna.json                # Lerna configuration
├── .eslintrc.json            # ESLint configuration
├── .prettierrc               # Prettier configuration
├── tsconfig.json             # Base TypeScript config
└── package.json              # Root workspace config
```

## Publishing to npm

Using Lerna for version management and publishing:

```bash
# Bump versions (follows semantic versioning)
npx lerna version

# Publish changed packages
npx lerna publish

# Or combine both
npx lerna publish --conventional-commits
```

For manual publishing of a specific package:

1. Update version in the package's `package.json`
2. Run pre-publish checks:
   ```bash
   cd packages/gql-mcp
   npm run prepublishOnly
   ```
3. Publish:
   ```bash
   npm publish
   ```

## Configuration Files

- **lerna.json**: Lerna configuration for monorepo management
- **tsconfig.json**: Base TypeScript configuration (strict mode enabled)
- **.eslintrc.json**: ESLint rules with TypeScript support
- **.prettierrc**: Code formatting rules
- **package.json**: Root workspace configuration with Lerna scripts

## Best Practices

1. Always build packages before running servers: `npm run build`
2. Use `npm run lint` before committing code
3. Run `npm run format` to ensure consistent code style
4. Use `npm run dev:all` to run both servers simultaneously during development
5. Use `npm run clean` before major rebuilds
6. Leverage Lerna's scoped commands for working with specific packages

## Adding New Packages

1. Create new directory (under `packages/` for libraries or at root for applications)
2. Add `package.json` with proper configuration
3. Create `tsconfig.json` extending root config
4. Add to workspaces in root `package.json` if needed
5. Lerna will automatically detect the new package

## Lerna Commands Reference

### Package Discovery
- `npx lerna list` - List all packages
- `npx lerna changed` - Show changed packages since last release

### Execution
- `npx lerna run <script>` - Run script in all packages
- `npx lerna run <script> --scope=<package>` - Run script in specific package
- `npx lerna run <script> --parallel` - Run script in all packages in parallel

### Versioning & Publishing
- `npx lerna version` - Bump versions
- `npx lerna publish` - Publish changed packages
- `npx lerna diff` - Show diff since last release

## Scripts Reference

### Root Level (Lerna-orchestrated)

**Build Commands:**
- `npm run build` - Build all packages in dependency order
- `npm run build:packages` - Build only gql-to-mcp
- `npm run build:servers` - Build only servers

**Development Commands:**
- `npm run dev:agentic` - Run agentic-commerce in dev mode
- `npm run dev:loyalty` - Run loyalty-mcp in dev mode
- `npm run dev:all` - Run both servers in parallel

**Production Commands:**
- `npm run start:agentic` - Run agentic-commerce in production
- `npm run start:loyalty` - Run loyalty-mcp in production

**Utility Commands:**
- `npm run clean` - Clean all build artifacts
- `npm run lint` - Lint all packages
- `npm run format` - Format all code
- `npm run format:check` - Check formatting
- `npm run type-check` - Type check all packages

### Package Level (Individual packages)

Each package (gql-to-mcp, agentic-commerce, loyalty-mcp) has:

- `npm run build` - Compile TypeScript
- `npm run clean` - Remove dist directory
- `npm run dev` - Run in development mode (servers only)
- `npm run start` - Run in production mode (servers only)
- `npm run lint` - Lint TypeScript files
- `npm run lint:fix` - Lint and auto-fix issues
- `npm run format` - Format source files
- `npm run format:check` - Check if files are formatted
- `npm run type-check` - Type check without compilation

## Troubleshooting

### Build fails
```bash
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Lerna not finding packages
- Ensure packages have valid `package.json` with `name` field
- Check that workspace globs in root `package.json` are correct
- Run `npx lerna list` to see detected packages

### Node version issues
```bash
# Switch to Node 20
nvm use 20
npm install
npm run build
```

## Additional Resources

- [Lerna Documentation](https://lerna.js.org/)
- [Lerna Guide](./LERNA-GUIDE.md) - Complete Lerna reference for this repo
- [Quick Start](./QUICK-START.md) - Quick command reference

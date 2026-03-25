# GQL-MCP Project Setup

## Overview

This is a clean TypeScript monorepo setup with:

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **npm workspaces** for monorepo management

## Installation

Install all dependencies:

```bash
npm install
```

## Development Workflow

### Building

```bash
# Build all packages
npm run build

# Build specific package
cd packages/gql-mcp-server
npm run build

# Clean build
npm run build:clean
```

### Linting

```bash
# Lint all packages
npm run lint

# Lint and auto-fix
cd packages/gql-mcp-server
npm run lint:fix
```

### Formatting

```bash
# Format all files
npm run format

# Check formatting
npm run format:check

# Format specific package
cd packages/gql-mcp-server
npm run format
```

### Type Checking

```bash
# Type check without emitting files
cd packages/gql-mcp-server
npm run type-check
```

## Package Structure

```
gql-mcp/
├── packages/
│   └── gql-mcp-server/
│       ├── src/           # TypeScript source files
│       ├── dist/          # Compiled JavaScript (gitignored)
│       ├── package.json
│       └── tsconfig.json
├── .eslintrc.json         # ESLint configuration
├── .prettierrc            # Prettier configuration
├── tsconfig.json          # Base TypeScript config
└── package.json           # Root workspace config
```

## Publishing to npm

1. Update version in `packages/gql-mcp-server/package.json`
2. Fill in author, repository, bugs, and homepage fields
3. Run pre-publish checks:
   ```bash
   cd packages/gql-mcp-server
   npm run prepublishOnly
   ```
4. Publish:
   ```bash
   npm publish
   ```

## Configuration Files

- **tsconfig.json**: Base TypeScript configuration (strict mode enabled)
- **.eslintrc.json**: ESLint rules with TypeScript support
- **.prettierrc**: Code formatting rules
- **package.json**: Workspace configuration with scripts

## Best Practices

1. Always run `npm run lint:fix` before committing
2. Use `npm run type-check` to catch type errors early
3. Run `npm run format` to ensure consistent code style
4. The `prepublishOnly` script ensures clean builds before publishing

## Adding New Packages

1. Create new directory under `packages/`
2. Add `package.json` with proper configuration
3. Create `tsconfig.json` extending root config
4. Add to workspace (automatic with `packages/*` glob)

## Scripts Reference

### Root Level

- `npm run build` - Build all packages
- `npm run lint` - Lint all packages
- `npm run format` - Format all files
- `npm run format:check` - Check formatting

### Package Level (gql-mcp-server)

- `npm run build` - Compile TypeScript
- `npm run build:clean` - Clean and rebuild
- `npm run dev` - Run in development mode
- `npm run lint` - Lint TypeScript files
- `npm run lint:fix` - Lint and auto-fix issues
- `npm run format` - Format source files
- `npm run format:check` - Check if files are formatted
- `npm run type-check` - Type check without compilation
- `npm run prepublishOnly` - Pre-publish validation

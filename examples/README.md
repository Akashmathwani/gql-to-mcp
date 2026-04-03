# gql-mcp Examples

This directory contains example configurations for running `gql-to-mcp` with GraphQL operations.

## Setup

The examples are already configured to use the local SDK from `packages/gql-mcp`.

To set up:

```bash
# From the repository root
npm install
npm run build
```

## Running the Examples

From this directory, you can run:

```bash
# Run the MCP server with the example configuration
npm run dev

# Or
npm start
```

This will start the MCP server using the configuration in `mcp-config.yaml`.

### Running with Custom Tools

To run the server with custom multi-step tools:

```bash
npm run custom-tools
```

This runs `custom-tools-example.ts`, which demonstrates:
- **Batch Search Tool**: Makes a single GraphQL request with multiple keywords
- **Parallel Search Tool**: Executes multiple GraphQL queries in parallel using `Promise.all`
- How to use the `ctx.gql()` helper to make GraphQL requests
- Combining results from multiple queries
- Error handling and logging

The custom tools are registered alongside all the `.graphql` operation tools.

## Configuration

The main configuration file is `mcp-config.yaml`, which includes:

- **GraphQL Endpoint**: Points to a GraphQL gateway (configured in the yaml)
- **Transport**: HTTP server on port 3000 with CORS enabled for MCP Inspector
- **Schema**: Local GraphQL schema file (`schema.graphql`)
- **Operations**: GraphQL queries and mutations in the `operations/` directory
- **Custom Scalars**: Type mappings for DateTime, Date, JSON, etc.

## Project Structure

```
examples/
├── mcp-config.yaml          # Main configuration file
├── schema.graphql           # GraphQL schema definition
├── operations/              # GraphQL operation files
│   ├── queries/            # Query operations
│   └── mutations/          # Mutation operations (disabled by default)
└── package.json            # Dependencies and scripts
```

## Customizing

To use this with your own GraphQL API:

1. Update the `endpoint` in `mcp-config.yaml` to point to your GraphQL server
2. Replace `schema.graphql` with your GraphQL schema
3. Add your GraphQL operations to the `operations/` directory
4. Update `custom_scalars` in the config if you use custom GraphQL scalars
5. Configure headers, authentication, and other settings as needed

## Testing with MCP Inspector

Once the server is running, you can test it with the MCP Inspector at `http://localhost:6274`.

The server exposes:

- Tools for each GraphQL query/mutation operation
- Resources for the GraphQL schema
- Logging and telemetry capabilities

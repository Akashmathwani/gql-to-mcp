#!/usr/bin/env node

import { createMcpServer } from './index.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * CLI entry point for gql-mcp server.
 * Usage: gql-mcp <config-file>
 */

const HELP = `
gql-mcp — GraphQL MCP Server

Usage:
  gql-mcp <config-file> [options]

Arguments:
  <config-file>    Path to YAML configuration file

Options:
  --help, -h       Show this help message
  --version, -v    Show version

Examples:
  gql-mcp ./mcp-config.yaml
  gql-mcp /etc/gql-mcp/config.yaml

Config file structure:
  server_info:     Server name, version
  endpoint:        GraphQL endpoint URL
  schema:          Schema source (local file or introspection)
  operations:      Directory containing .graphql operation files
  transport:       Transport type (streamable_http | stdio) and options
  headers:         Static headers forwarded to every GraphQL request
  forward_headers: Inbound MCP headers to forward to GraphQL endpoint
  overrides:       Mutation mode, tool description overrides
  custom_scalars:  JSON Schema mappings for custom GraphQL scalars
  logging:         Log level and format
  telemetry:       OTLP tracing and metrics exporters

Docs: https://github.com/your-org/gql-mcp
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // ── Flags ──────────────────────────────────────────────────────────────────
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP + '\n');
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
    ) as { version: string };
    process.stdout.write(pkg.version + '\n');
    process.exit(0);
  }

  // ── Config path ────────────────────────────────────────────────────────────
  const configArg = args.find((a) => !a.startsWith('--'));
  if (!configArg) {
    process.stderr.write('❌ Error: No config file specified\n');
    process.stderr.write('   Run gql-mcp --help for usage\n');
    process.exit(1);
  }

  const configPath = path.isAbsolute(configArg)
    ? configArg
    : path.resolve(process.cwd(), configArg);

  if (!fs.existsSync(configPath)) {
    process.stderr.write(`❌ Error: Config file not found: ${configPath}\n`);
    process.exit(1);
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  try {
    const server = createMcpServer({ config: configPath });

    await server.start();

    // ── Graceful shutdown ────────────────────────────────────────────────────
    const shutdown = (signal: string) => {
      process.stderr.write(`\n⏹  Received ${signal}, shutting down...\n`);
      server
        .stop()
        .then(() => {
          process.stderr.write('✓ Shutdown complete\n');
          process.exit(0);
        })
        .catch((err: unknown) => {
          process.stderr.write(
            `⚠ Error during shutdown: ${err instanceof Error ? err.message : String(err)}\n`
          );
          process.exit(1);
        });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Keep process alive for HTTP transport
    // (stdio transport keeps itself alive via stdin)
    if (process.stdin.isTTY === false) {
      process.stdin.resume();
    }
  } catch (err) {
    if (err instanceof Error) {
      process.stderr.write(`❌ ${err.message}\n`);
      if (process.env['DEBUG']) {
        process.stderr.write((err.stack ?? '') + '\n');
      }
    } else {
      process.stderr.write('❌ Unknown error during startup\n');
    }
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`❌ Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

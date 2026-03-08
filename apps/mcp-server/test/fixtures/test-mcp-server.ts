#!/usr/bin/env npx tsx
/**
 * Minimal MCP server (stdio) for testing the gateway.
 * Exposes two tools: echo and add.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer(
  { name: 'test-tools', version: '0.1.0' },
  {},
);

server.registerTool(
  'echo',
  {
    description: 'Echoes back the input message',
    inputSchema: {
      message: z.string().describe('The message to echo'),
    },
  },
  async (args: { message: string }) => ({
    content: [{ type: 'text' as const, text: `Echo: ${args.message}` }],
  }),
);

server.registerTool(
  'add',
  {
    description: 'Adds two numbers',
    inputSchema: {
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    },
  },
  async (args: { a: number; b: number }) => ({
    content: [{ type: 'text' as const, text: `Result: ${args.a + args.b}` }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[test-mcp-server] Running on stdio');
}

main().catch(err => {
  console.error('[test-mcp-server] Fatal:', err);
  process.exit(1);
});

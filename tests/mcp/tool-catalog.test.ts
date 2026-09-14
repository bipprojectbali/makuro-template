import { describe, expect, test } from 'bun:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCP_TOOL_CATALOG } from '../../server/mcp/tool-catalog';
import { registerAppStatusTool } from '../../server/mcp/tools/app-status';
import { registerDbTools } from '../../server/mcp/tools/db';
import { registerFileHealthTool } from '../../server/mcp/tools/file-health';
import { registerLogTools } from '../../server/mcp/tools/logs';

/** Capture registered tool names without an MCP transport. */
function collectRegistered(): string[] {
  const names: string[] = [];
  const fake = { registerTool: (name: string) => names.push(name) } as unknown as McpServer;
  registerAppStatusTool(fake);
  registerLogTools(fake);
  registerDbTools(fake);
  registerFileHealthTool(fake);
  return names.sort();
}

describe('MCP tool catalog', () => {
  test('lists exactly the tools that are registered', () => {
    expect(MCP_TOOL_CATALOG.map((t) => t.name).sort()).toEqual(collectRegistered());
  });
  test('every entry has a description and a group', () => {
    for (const t of MCP_TOOL_CATALOG) {
      expect(t.description.length).toBeGreaterThan(5);
      expect(['status', 'logs', 'db', 'code']).toContain(t.group);
    }
  });
});

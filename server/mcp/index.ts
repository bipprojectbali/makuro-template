import { mcp } from 'elysia-mcp';
import { env } from '../env';
import { registerAppStatusTool } from './tools/app-status';
import { registerDbTools } from './tools/db';
import { registerLogTools } from './tools/logs';

/** Extracts the MCP admin token from either Bearer header or ?mcpAdminToken query param. */
function resolveToken(request: Request): string | null {
  const bearer = request.headers.get('Authorization');
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  try {
    return new URL(request.url).searchParams.get('mcpAdminToken');
  } catch {
    return null;
  }
}

export const mcpPlugin = mcp({
  serverInfo: { name: 'makuro-debug', version: '1.0.0' },
  capabilities: { tools: {} },
  authentication: async (ctx) => {
    if (!env.MCP_ADMIN_TOKEN) {
      return {
        response: new Response('MCP is disabled (MCP_ADMIN_TOKEN not set)', { status: 503 }),
      };
    }
    const token = resolveToken(ctx.request);
    if (!token || token !== env.MCP_ADMIN_TOKEN) {
      return { response: new Response('Unauthorized', { status: 401 }) };
    }
    // AuthInfo requires token + clientId + scopes per MCP SDK.
    return { authInfo: { token, clientId: 'makuro-debug', scopes: [] } };
  },
  setupServer: async (server) => {
    registerAppStatusTool(server);
    registerLogTools(server);
    registerDbTools(server);
  },
});

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { env } from '../../env';

const startedAt = Date.now();

export function registerAppStatusTool(server: McpServer) {
  server.registerTool(
    'get_app_status',
    {
      description: 'Get current app runtime status: environment, uptime, memory usage, and port.',
      inputSchema: {},
    },
    async () => {
      const mem = process.memoryUsage();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                env: env.NODE_ENV,
                port: env.PORT,
                appUrl: env.APP_URL,
                uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
                memory: {
                  heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                  heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
                  rssMb: Math.round(mem.rss / 1024 / 1024),
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { count, desc, gt, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { account, post, session, user } from '../../db/schema';

export function registerDbTools(server: McpServer) {
  server.registerTool(
    'get_db_stats',
    {
      description: 'Get row counts for all main database tables.',
      inputSchema: {},
    },
    async () => {
      const [[userRow], [sessionRow], [accountRow], [postRow]] = await Promise.all([
        db.select({ count: count() }).from(user),
        db.select({ count: count() }).from(session),
        db.select({ count: count() }).from(account),
        db.select({ count: count() }).from(post),
      ]);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                user: userRow.count,
                session: sessionRow.count,
                account: accountRow.count,
                post: postRow.count,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'list_users',
    {
      description: 'List users ordered by creation date. Optionally filter by email or name.',
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe('Case-insensitive substring filter on email or name'),
        limit: z.number().min(1).max(100).optional().describe('Max users to return (default 20)'),
      },
    },
    async (args) => {
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(
          args.search
            ? or(like(user.email, `%${args.search}%`), like(user.name, `%${args.search}%`))
            : undefined,
        )
        .orderBy(desc(user.createdAt))
        .limit(args.limit ?? 20);
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.registerTool(
    'get_active_sessions',
    {
      description: 'List currently active (non-expired) sessions ordered by creation date.',
      inputSchema: {
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Max sessions to return (default 20)'),
      },
    },
    async (args) => {
      const rows = await db
        .select({
          id: session.id,
          userId: session.userId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          impersonatedBy: session.impersonatedBy,
        })
        .from(session)
        .where(gt(session.expiresAt, new Date()))
        .orderBy(desc(session.createdAt))
        .limit(args.limit ?? 20);
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.registerTool(
    'get_recent_posts',
    {
      description: 'List most recent posts ordered by creation date.',
      inputSchema: {
        limit: z.number().min(1).max(100).optional().describe('Max posts to return (default 20)'),
      },
    },
    async (args) => {
      const rows = await db
        .select()
        .from(post)
        .orderBy(desc(post.createdAt))
        .limit(args.limit ?? 20);
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );
}

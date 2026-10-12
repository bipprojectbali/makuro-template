import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { count, inArray } from 'drizzle-orm';
import { db } from '../../server/db';
import { user } from '../../server/db/schema';
import { registerDbTools } from '../../server/mcp/tools/db';

type ToolResult = { content: Array<{ text: string }> };
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

// Call tool handlers directly: the HTTP endpoint suite is skipped without MCP_ADMIN_TOKEN.
const handlers = new Map<string, Handler>();
registerDbTools({
  registerTool: (name: string, _cfg: unknown, handler: Handler) => handlers.set(name, handler),
} as unknown as McpServer);
const call = async (name: string, args: Record<string, unknown> = {}) =>
  JSON.parse((await (handlers.get(name) as Handler)(args)).content[0].text);

const TAG = `mcpdemo-${crypto.randomUUID().slice(0, 8)}`;
const realId = `${TAG}-real`;
const demoId = `${TAG}-demo`;

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values([
    {
      id: realId,
      name: `${TAG} Real`,
      email: `${TAG}-real@test.local`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: demoId,
      name: `${TAG} Demo`,
      email: `${TAG}-demo@test.local`,
      isAnonymous: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, [realId, demoId]));
});

describe('MCP db tools exclude demo users', () => {
  test('list_users omits anonymous demo users', async () => {
    const rows = (await call('list_users', { search: TAG })) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).toEqual([realId]);
  });

  test('get_db_stats user count skips anonymous demo users', async () => {
    const stats = (await call('get_db_stats')) as { user: number };
    const [all] = await db.select({ n: count() }).from(user);
    expect(stats.user).toBeLessThan(all.n);
  });
});

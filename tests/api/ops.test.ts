import { afterAll, describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({
    user: { id: 'u-test', email: 'u-test@test.local' },
    role: 'super-admin',
  }),
}));

import { eq } from 'drizzle-orm';
import { opsApi, RESET_TARGETS } from '../../server/api/ops';
import { db } from '../../server/db';
import { auditLog } from '../../server/db/schema';
import { logBuffer } from '../../server/mcp/log-buffer';
import { rateLimiter } from '../../server/middleware/rate-limiter';

const app = new Elysia().use(opsApi);
async function call(path: string, init?: RequestInit) {
  const res = await app.handle(new Request(`http://localhost${path}`, init));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

afterAll(async () => {
  await db
    .delete(auditLog)
    .where(eq(auditLog.action, 'ops.reset'))
    .catch(() => {});
});

describe('ops API', () => {
  test('status reports process, db latency, limiter and log buffer', async () => {
    const { status, body } = await call('/ops/status');
    expect(status).toBe(200);
    expect(typeof body.uptimeSeconds).toBe('number');
    expect((body.dbLatencyMs as number) >= 0).toBe(true);
    expect((body.logBuffer as { capacity: number }).capacity).toBe(logBuffer.maxSize);
    expect(typeof body.bun).toBe('string');
  });
  test('mcp catalog never leaks the token', async () => {
    const { body } = await call('/ops/mcp');
    expect(Array.isArray(body.tools)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(process.env.MCP_ADMIN_TOKEN ?? '___none___');
    expect((body.endpoint as string).endsWith('/api/mcp')).toBe(true);
  });
  test('reset targets clear state and audit; unknown target → 404', async () => {
    rateLimiter.check('ops-test-ip');
    expect(rateLimiter.size).toBeGreaterThanOrEqual(1);
    const { status } = await call('/ops/reset/limiter', { method: 'POST' });
    expect(status).toBe(200);
    expect(rateLimiter.size).toBe(0);
    logBuffer.push({ level: 30, time: Date.now(), msg: 'ops-test' });
    await call('/ops/reset/logs', { method: 'POST' });
    expect(logBuffer.size()).toBe(0);
    expect((await call('/ops/reset/nope', { method: 'POST' })).status).toBe(404);
    expect(Object.keys(RESET_TARGETS).sort()).toEqual([
      'file-health',
      'limiter',
      'logs',
      'settings',
    ]);
    const targets = await call('/ops/reset-targets');
    expect((targets.body as unknown as Array<{ key: string }>).length).toBe(4);
  });
});

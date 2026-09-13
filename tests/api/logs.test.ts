import { describe, expect, mock, test } from 'bun:test';
import Elysia from 'elysia';

mock.module('../../server/guard', () => ({
  requireRole: async () => ({ user: { id: 'u-test' }, role: 'super-admin' }),
}));

import { errorsLastHour, logsApi } from '../../server/api/logs';
import { LogBuffer, logBuffer } from '../../server/mcp/log-buffer';

const app = new Elysia().use(logsApi);
const TAG = `log-${crypto.randomUUID().slice(0, 8)}`;

describe('LogBuffer stats/countSince', () => {
  test('counts by level and since a timestamp; assigns seq', () => {
    const b = new LogBuffer(10);
    const now = Date.now();
    b.push({ level: 30, time: now - 10_000, msg: 'a' });
    b.push({ level: 50, time: now - 5_000, msg: 'b' });
    b.push({ level: 50, time: now - 7_200_000, msg: 'old' });
    const s = b.stats();
    expect(s.byLevel.info).toBe(1);
    expect(s.byLevel.error).toBe(2);
    expect(s.size).toBe(3);
    expect(s.capacity).toBe(10);
    expect(b.countSince(50, now - 3_600_000)).toBe(1);
    expect(b.query({}).map((e) => e.seq)).toEqual([1, 2, 3]);
  });
});

describe('GET /logs', () => {
  test('returns newest first with levelName, filters by level and search', async () => {
    logBuffer.push({ level: 30, time: Date.now() - 2000, msg: `${TAG} info line` });
    logBuffer.push({ level: 50, time: Date.now() - 1000, msg: `${TAG} boom`, userId: 'u1' });
    const res = await app.handle(new Request(`http://localhost/logs?search=${TAG}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: Array<{ msg: string; levelName: string }>;
      buffered: number;
    };
    expect(body.rows.length).toBe(2);
    expect(body.rows[0].msg).toContain('boom');
    expect(body.rows[0].levelName).toBe('error');
    const errs = (await (
      await app.handle(new Request(`http://localhost/logs?search=${TAG}&level=error`))
    ).json()) as { rows: unknown[] };
    expect(errs.rows.length).toBe(1);
  });

  test('stats endpoint and errorsLastHour agree', async () => {
    const body = (await (await app.handle(new Request('http://localhost/logs/stats'))).json()) as {
      errorsLastHour: number;
      capacity: number;
    };
    expect(body.capacity).toBe(logBuffer.maxSize);
    expect(body.errorsLastHour).toBe(errorsLastHour());
    expect(body.errorsLastHour).toBeGreaterThanOrEqual(1);
  });
});

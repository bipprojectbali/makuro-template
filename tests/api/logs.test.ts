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

describe('LogBuffer.page', () => {
  test('newest-first pages with total; before pins pages against new pushes', () => {
    const b = new LogBuffer(100);
    for (let i = 1; i <= 7; i++) b.push({ level: 30, time: i, msg: `m${i}` });
    const p1 = b.page({}, 1, 3);
    expect(p1.rows.map((e) => e.msg)).toEqual(['m7', 'm6', 'm5']);
    expect(p1.total).toBe(7);
    expect(b.page({}, 3, 3).rows.map((e) => e.msg)).toEqual(['m1']);
    expect(b.page({}, 4, 3).rows).toEqual([]);

    const anchor = p1.rows[0]?.seq ?? 0;
    b.push({ level: 30, time: 8, msg: 'm8' });
    b.push({ level: 30, time: 9, msg: 'm9' });
    const p2 = b.page({ before: anchor }, 2, 3);
    expect(p2.rows.map((e) => e.msg)).toEqual(['m4', 'm3', 'm2']);
    expect(p2.total).toBe(7);
    expect(b.page({}, 1, 3).total).toBe(9);
  });
});

describe('GET /logs paging', () => {
  const tag = `${TAG}-page`;
  const get = async (q: string) =>
    (await (await app.handle(new Request(`http://localhost/logs?search=${tag}&${q}`))).json()) as {
      rows: Array<{ msg: string; seq: number }>;
      total: number;
      page: number;
      limit: number;
    };

  test('page/limit/before contract and robust parsing', async () => {
    for (let i = 1; i <= 5; i++)
      logBuffer.push({ level: 30, time: Date.now(), msg: `${tag} ${i}` });
    const p1 = await get('page=1&limit=2');
    expect(p1.rows.map((r) => r.msg)).toEqual([`${tag} 5`, `${tag} 4`]);
    expect(p1).toMatchObject({ total: 5, page: 1, limit: 2 });

    logBuffer.push({ level: 30, time: Date.now(), msg: `${tag} 6` });
    const p2 = await get(`page=2&limit=2&before=${p1.rows[0]?.seq}`);
    expect(p2.rows.map((r) => r.msg)).toEqual([`${tag} 3`, `${tag} 2`]);
    expect(p2.total).toBe(5);

    const bad = await get('page=abc&limit=-5&before=xyz');
    expect(bad).toMatchObject({ page: 1, limit: 200, total: 6 });
    expect(bad.rows.map((r) => r.msg)).toEqual([6, 5, 4, 3, 2, 1].map((i) => `${tag} ${i}`));
    expect((await get('page=-3&limit=99999')).limit).toBe(500);
  });
});

describe('LogBuffer subscribe/after', () => {
  test('notifies subscribers until unsubscribed; after filters by seq', () => {
    const b = new LogBuffer(10);
    const seen: number[] = [];
    const off = b.subscribe((e) => seen.push(e.seq ?? 0));
    b.push({ level: 30, time: 1, msg: 'a' });
    b.push({ level: 30, time: 2, msg: 'b' });
    off();
    b.push({ level: 30, time: 3, msg: 'c' });
    expect(seen).toEqual([1, 2]);
    expect(b.query({ after: 2 }).map((e) => e.msg)).toEqual(['c']);
  });
});

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, needle: string) {
  const dec = new TextDecoder();
  let text = '';
  while (!text.includes(needle)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += dec.decode(value);
  }
  return text;
}

describe('GET /logs/stream (SSE)', () => {
  test('replays entries after the cursor, then pushes new matching ones', async () => {
    const tag = `${TAG}-sse`;
    logBuffer.push({ level: 30, time: Date.now(), msg: `${tag} old` });
    const cursor = logBuffer.query({}).at(-1)?.seq ?? 0;
    logBuffer.push({ level: 50, time: Date.now(), msg: `${tag} replayed` });

    const res = await app.handle(
      new Request(`http://localhost/logs/stream?search=${tag}&after=${cursor}`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();

    const first = await readUntil(reader, 'replayed');
    expect(first).toContain('retry:');
    expect(first).not.toContain(`${tag} old`);
    expect(first).toContain('"levelName":"error"');

    logBuffer.push({ level: 30, time: Date.now(), msg: 'unrelated line' });
    logBuffer.push({ level: 30, time: Date.now(), msg: `${tag} live` });
    const next = await readUntil(reader, 'live');
    expect(next).not.toContain('unrelated line');
    expect(next).toMatch(/id: \d+\ndata: .*live/);
    await reader.cancel();
  });

  test('Last-Event-ID takes precedence over ?after', async () => {
    const tag = `${TAG}-lei`;
    logBuffer.push({ level: 30, time: Date.now(), msg: `${tag} one` });
    const lastId = logBuffer.query({}).at(-1)?.seq ?? 0;
    logBuffer.push({ level: 30, time: Date.now(), msg: `${tag} two` });
    const res = await app.handle(
      new Request(`http://localhost/logs/stream?search=${tag}&after=0`, {
        headers: { 'Last-Event-ID': String(lastId) },
      }),
    );
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const text = await readUntil(reader, 'two');
    expect(text).not.toContain(`${tag} one`);
    await reader.cancel();
  });
});

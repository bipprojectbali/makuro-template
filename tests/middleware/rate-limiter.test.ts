import { describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { CLIENT_IP_HEADER } from '../../server/middleware/client-ip';
import { RateLimiter, rateLimitPlugin } from '../../server/middleware/rate-limiter';

describe('RateLimiter.check', () => {
  it('allows `limit` requests then blocks with a retry hint', () => {
    const rl = new RateLimiter({ windowMs: 60_000, limit: 3 });
    const t0 = 1_000_000;
    expect(rl.check('a', t0).limited).toBe(false);
    expect(rl.check('a', t0 + 10).limited).toBe(false);
    const third = rl.check('a', t0 + 20);
    expect(third.limited).toBe(false);
    expect(third.remaining).toBe(0);
    const blocked = rl.check('a', t0 + 30);
    expect(blocked.limited).toBe(true);
    expect(blocked.retryAfterMs).toBe(60_000 - 30);
    expect(blocked.resetAt).toBe(t0 + 60_000);
  });

  it('blocked attempts do not extend the window (backing off always works)', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 1 });
    rl.check('b', 0);
    for (let t = 100; t < 1_000; t += 100) expect(rl.check('b', t).limited).toBe(true);
    expect(rl.check('b', 1_001).limited).toBe(false);
  });

  it('slides: old hits fall out as time passes', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 2 });
    rl.check('c', 0);
    rl.check('c', 500);
    expect(rl.check('c', 900).limited).toBe(true);
    expect(rl.check('c', 1_001).limited).toBe(false); // hit at 0 expired
    expect(rl.check('c', 1_100).limited).toBe(true); // 500 + 1001 still inside
  });

  it('counts independently per key and shares one bucket for null (unknown) IPs', () => {
    const rl = new RateLimiter({ windowMs: 60_000, limit: 1 });
    expect(rl.check('x').limited).toBe(false);
    expect(rl.check('y').limited).toBe(false);
    expect(rl.check(null).limited).toBe(false);
    expect(rl.check(null).limited).toBe(true);
  });

  it('prune drops expired keys', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 5 });
    rl.check('p', 0);
    rl.check('q', 900);
    rl.prune(1_500);
    expect(rl.size).toBe(1);
  });

  it('configure() swaps limits at runtime and enabled=false disables the plugin', async () => {
    const rl = new RateLimiter({ windowMs: 60_000, limit: 1 });
    rl.configure({ limit: 3 });
    expect(rl.config.limit).toBe(3);
    expect(rl.config.windowMs).toBe(60_000);
    const app = new Elysia({ prefix: '/api' }).use(rateLimitPlugin(rl)).get('/x', () => 'ok');
    const hit = () =>
      app.handle(
        new Request('http://localhost/api/x', { headers: { [CLIENT_IP_HEADER]: '10.9.9.9' } }),
      );
    for (let i = 0; i < 3; i++) expect((await hit()).status).toBe(200);
    expect((await hit()).status).toBe(429);
    rl.configure({ enabled: false });
    expect((await hit()).status).toBe(200);
  });

  it('excludes configured prefixes', () => {
    const rl = new RateLimiter();
    expect(rl.isExcluded('/api/auth/sign-in/email')).toBe(true);
    expect(rl.isExcluded('/api/mcp')).toBe(true);
    expect(rl.isExcluded('/api/admin/users')).toBe(false);
  });
});

describe('rateLimitPlugin', () => {
  const build = (limit: number) => {
    const limiter = new RateLimiter({ windowMs: 60_000, limit });
    const child = new Elysia({ prefix: '/child' }).get('/x', () => ({ ok: true }));
    const app = new Elysia({ prefix: '/api' })
      .use(rateLimitPlugin(limiter))
      .use(child)
      .get('/own', () => ({ ok: true }))
      .get('/auth/session', () => ({ ok: true }));
    return { app, limiter };
  };
  const hit = (app: { handle: (r: Request) => Promise<Response> }, path: string, ip: string) =>
    app.handle(new Request(`http://localhost${path}`, { headers: { [CLIENT_IP_HEADER]: ip } }));

  it('covers routes from plugins registered after it (the original bug)', async () => {
    const { app } = build(1);
    expect((await hit(app, '/api/child/x', '10.0.0.1')).status).toBe(200);
    const blocked = await hit(app, '/api/child/x', '10.0.0.1');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('60');
  });

  it('429 uses the standard API error shape plus retryAfterSeconds', async () => {
    const { app } = build(1);
    await hit(app, '/api/own', '10.0.0.5');
    const res = await hit(app, '/api/own', '10.0.0.5');
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Terlalu banyak request. Coba lagi dalam 60 detik.');
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.status).toBe(429);
    expect(body.retryAfterSeconds).toBe(60);
    expect(typeof body.requestId).toBe('string');
    expect((body.requestId as string).length).toBeGreaterThan(0);
    expect(res.headers.get('x-request-id')).toBe(body.requestId as string);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(res.headers.get('x-ratelimit-limit')).toBe('1');
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('logs one row per blocking episode, not per rejected request', async () => {
    const limiter = new RateLimiter({ windowMs: 60_000, limit: 1 });
    const log = mock(async (_: { ip: string | null; path: string }) => {});
    const app = new Elysia({ prefix: '/api' })
      .use(rateLimitPlugin(limiter, log))
      .get('/own', () => ({ ok: true }));
    await hit(app, '/api/own', '10.0.0.6');
    for (let i = 0; i < 5; i++) expect((await hit(app, '/api/own', '10.0.0.6')).status).toBe(429);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatchObject({ ip: '10.0.0.6', path: '/api/own' });
    await hit(app, '/api/own', '10.0.0.7');
    await hit(app, '/api/own', '10.0.0.7');
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('adds X-RateLimit headers and keys by client IP', async () => {
    const { app } = build(2);
    const first = await hit(app, '/api/own', '10.0.0.2');
    expect(first.headers.get('x-ratelimit-limit')).toBe('2');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('1');
    await hit(app, '/api/own', '10.0.0.2');
    expect((await hit(app, '/api/own', '10.0.0.2')).status).toBe(429);
    expect((await hit(app, '/api/own', '10.0.0.3')).status).toBe(200);
  });

  it('never limits excluded prefixes', async () => {
    const { app } = build(1);
    for (let i = 0; i < 3; i++)
      expect((await hit(app, '/api/auth/session', '10.0.0.4')).status).toBe(200);
  });
});

describe('RateLimiter episodes & memory bound', () => {
  it('flags episodeStart once per window and again in the next window', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 1 });
    expect(rl.check('e', 0).episodeStart).toBe(false);
    expect(rl.check('e', 100).episodeStart).toBe(true);
    expect(rl.check('e', 500).episodeStart).toBe(false);
    expect(rl.check('e', 1_050).limited).toBe(false);
    expect(rl.check('e', 1_060).episodeStart).toBe(false); // still within 1s of the logged rejection
    expect(rl.check('e', 1_200).episodeStart).toBe(true); // new window
  });

  it('prune keeps a key whose episode is still inside the window', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 1 });
    rl.check('k', 0);
    rl.check('k', 900);
    rl.prune(1_500);
    expect(rl.size).toBe(1);
    rl.prune(1_901);
    expect(rl.size).toBe(0);
  });

  it('caps tracked keys: prunes expired first, then evicts the oldest', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 1 }, 3);
    rl.check('old', 0);
    rl.check('a', 1_500);
    rl.check('b', 1_600);
    rl.check('c', 1_700); // 'old' expired → pruned, nothing live evicted
    expect(rl.size).toBe(3);
    expect(rl.check('a', 1_800).limited).toBe(true);
    rl.check('d', 1_900); // all live → oldest ('a') evicted
    expect(rl.size).toBe(3);
    expect(rl.check('a', 1_950).limited).toBe(false); // counter reset by eviction
    expect(rl.size).toBe(3);
    expect(rl.check('c', 1_960).limited).toBe(true);
  });
});

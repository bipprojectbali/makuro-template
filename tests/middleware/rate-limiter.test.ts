import { describe, expect, it } from 'bun:test';
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
    expect(((await blocked.json()) as { error: string }).error).toBe('Too many requests');
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

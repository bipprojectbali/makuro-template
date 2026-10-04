import { afterEach, describe, expect, it, mock, setSystemTime, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { apiErrorPlugin } from '../../server/api-error';
import { apiKeyPlugin } from '../../server/api-keys/plugin';
import { API_KEY_PREFIX, auth } from '../../server/auth';
import { CLIENT_IP_HEADER } from '../../server/middleware/client-ip';
import { RateLimiter, rateLimitPlugin } from '../../server/middleware/rate-limiter';
import { rateLimitKey } from '../../server/rate-limit';

/** Multiple of 60_000 so a 60 s window starts exactly here. */
const T0 = 1_800_000_000_000;

afterEach(() => setSystemTime());

describe('RateLimiter.check (sliding-window counter)', () => {
  it('weights the previous window by the remaining fraction across a boundary', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 10 });
    for (const t of [100, 200, 300, 400]) expect(rl.check('w', t).limited).toBe(false);
    // 1250: prev=4 weighted 0.75 → 3, +1 accepted → 4 → remaining floor(10-4)=6
    expect(rl.check('w', 1_250)).toMatchObject({ limited: false, remaining: 6 });
    // 1600: 4×0.4 + 1 = 2.6, +1 → 3.6 → remaining floor(6.4)=6
    expect(rl.check('w', 1_600)).toMatchObject({ limited: false, remaining: 6 });
    // 2500: prev=2 (window 1) ×0.5 = 1, +1 → 2 → remaining 8
    expect(rl.check('w', 2_500)).toMatchObject({ limited: false, remaining: 8 });
  });

  it('remaining = floor(limit − estimate after counting), 0 when blocked', () => {
    const rl = new RateLimiter({ windowMs: 60_000, limit: 3 });
    expect(rl.check('r', 0).remaining).toBe(2);
    expect(rl.check('r', 10).remaining).toBe(1);
    expect(rl.check('r', 20).remaining).toBe(0);
    expect(rl.check('r', 30)).toMatchObject({ limited: true, remaining: 0 });
  });

  it('Retry-After is exact: blocked 1 ms before, accepted at it', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 4 });
    for (const t of [0, 1, 2, 3]) rl.check('x', t);
    rl.check('x', 1_250); // 4×0.75 + 0 = 3 → accepted, curr=1
    const blocked = rl.check('x', 1_260); // 4×0.74 + 1 = 3.96
    expect(blocked.limited).toBe(true);
    // needs 4×(1−e/1000) + 1 ≤ 3 → e ≥ 500 → 1500 − 1260
    expect(blocked.retryAfterMs).toBe(240);
    expect(rl.check('x', 1_499).limited).toBe(true);
    expect(rl.check('x', 1_500).limited).toBe(false);
  });

  it('Retry-After spans into the next window when the current one is full', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 2 });
    rl.check('n', 100);
    rl.check('n', 200);
    const blocked = rl.check('n', 300);
    // next window: 2×(1−e/1000) ≤ 1 → e ≥ 500 → 1500 − 300
    expect(blocked.retryAfterMs).toBe(1_200);
    expect(rl.check('n', 1_499).limited).toBe(true);
    expect(rl.check('n', 1_500).limited).toBe(false);
  });

  it('Retry-After has no float overshoot at an exact boundary', () => {
    const rl = new RateLimiter({ windowMs: 60_000, limit: 3 });
    for (const t of [0, 1, 2]) rl.check('f', t);
    // 60000 × (1 − 2/3) evaluates to 20000.000000000004 in floats
    const blocked = rl.check('f', 60_000);
    expect(blocked.retryAfterMs).toBe(20_000);
    expect(rl.check('f', 80_000).limited).toBe(false);
  });

  it('rejected requests are not counted', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 2 });
    rl.check('b', 100);
    rl.check('b', 200);
    for (let t = 300; t < 1_500; t += 50) expect(rl.check('b', t).limited).toBe(true);
    // Had the ~24 rejections counted, the key would stay blocked for windows.
    expect(rl.check('b', 1_500).limited).toBe(false);
  });

  it('counts independently per key and shares one bucket for null (unknown) IPs', () => {
    const rl = new RateLimiter({ windowMs: 60_000, limit: 1 });
    expect(rl.check('x').limited).toBe(false);
    expect(rl.check('y').limited).toBe(false);
    expect(rl.check(null).limited).toBe(false);
    expect(rl.check(null).limited).toBe(true);
  });

  it('configure(): limit change keeps counters; window change resets them without NaN', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 1 });
    rl.check('c', 100);
    rl.configure({ limit: 2, windowMs: 1_000 });
    expect(rl.size).toBe(1);
    expect(rl.check('c', 200).limited).toBe(false);
    expect(rl.check('c', 300).limited).toBe(true);
    rl.configure({ windowMs: 60_000 });
    expect(rl.size).toBe(0);
    const r1 = rl.check('c', 400);
    expect(r1).toMatchObject({ limited: false, remaining: 1, retryAfterMs: 0 });
    rl.check('c', 500);
    const r3 = rl.check('c', 600);
    expect(r3.limited).toBe(true);
    expect(Number.isFinite(r3.retryAfterMs) && r3.retryAfterMs > 0).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('excludes configured prefixes', () => {
    const rl = new RateLimiter();
    expect(rl.isExcluded('/api/auth/sign-in/email')).toBe(true);
    expect(rl.isExcluded('/api/mcp')).toBe(true);
    expect(rl.isExcluded('/api/admin/users')).toBe(false);
  });
});

describe('rateLimitKey', () => {
  it('keeps IPv4 as-is and passes null through', () => {
    expect(rateLimitKey('203.0.113.5')).toBe('203.0.113.5');
    expect(rateLimitKey(null)).toBeNull();
  });

  it('buckets IPv6 by canonical /64', () => {
    expect(rateLimitKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(rateLimitKey('2001:DB8:1:2:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(rateLimitKey('2001:0db8:0000:0000::1')).toBe('2001:db8::/64');
    expect(rateLimitKey('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64');
    expect(rateLimitKey('fe80::1%eth0')).toBe('fe80::/64');
    expect(rateLimitKey('::1.2.3.4')).toBe('::/64');
  });
});

describe('rateLimitPlugin', () => {
  const build = (limit: number, log = mock(async (_: { ip: string | null }) => {})) => {
    const limiter = new RateLimiter({ windowMs: 60_000, limit });
    const child = new Elysia({ prefix: '/child' }).get('/x', () => ({ ok: true }));
    const app = new Elysia({ prefix: '/api' })
      .use(rateLimitPlugin(limiter, log))
      .use(child)
      .get('/own', () => ({ ok: true }))
      .get('/auth/session', () => ({ ok: true }));
    return { app, limiter, log };
  };
  const hit = (
    app: { handle: (r: Request) => Promise<Response> },
    path: string,
    ip: string,
    extra: Record<string, string> = {},
  ) =>
    app.handle(
      new Request(`http://localhost${path}`, { headers: { [CLIENT_IP_HEADER]: ip, ...extra } }),
    );

  it('covers routes from plugins registered after it', async () => {
    const { app } = build(1);
    expect((await hit(app, '/api/child/x', '10.0.0.1')).status).toBe(200);
    expect((await hit(app, '/api/child/x', '10.0.0.1')).status).toBe(429);
  });

  it('429 uses the standard API error shape plus retryAfterSeconds', async () => {
    setSystemTime(new Date(T0));
    const { app } = build(1);
    await hit(app, '/api/own', '10.0.0.5');
    const res = await hit(app, '/api/own', '10.0.0.5');
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    // limit 1 at window start: the hit decays to 0 only at the end of the next window
    expect(body.error).toBe('Terlalu banyak request. Coba lagi dalam 120 detik.');
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.status).toBe(429);
    expect(body.retryAfterSeconds).toBe(120);
    expect((body.requestId as string).length).toBeGreaterThan(0);
    expect(res.headers.get('x-request-id')).toBe(body.requestId as string);
    expect(res.headers.get('retry-after')).toBe('120');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-ratelimit-limit')).toBe('1');
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('a client that waits Retry-After gets through', async () => {
    setSystemTime(new Date(T0));
    const { app } = build(2);
    await hit(app, '/api/own', '10.0.0.8');
    await hit(app, '/api/own', '10.0.0.8');
    const blocked = await hit(app, '/api/own', '10.0.0.8');
    const wait = Number(blocked.headers.get('retry-after'));
    expect(wait).toBe(90);
    setSystemTime(new Date(T0 + (wait - 1) * 1_000));
    expect((await hit(app, '/api/own', '10.0.0.8')).status).toBe(429);
    setSystemTime(new Date(T0 + wait * 1_000));
    expect((await hit(app, '/api/own', '10.0.0.8')).status).toBe(200);
  });

  it('logs one row per blocking episode, not per rejected request', async () => {
    const { app, log } = build(1);
    await hit(app, '/api/own', '10.0.0.6');
    for (let i = 0; i < 5; i++) expect((await hit(app, '/api/own', '10.0.0.6')).status).toBe(429);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatchObject({ ip: '10.0.0.6', path: '/api/own' });
    await hit(app, '/api/own', '10.0.0.7');
    await hit(app, '/api/own', '10.0.0.7');
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('IPv6 in one /64 shares a bucket, logs the full IP; another /64 is separate', async () => {
    const { app, log } = build(1);
    expect((await hit(app, '/api/own', '2001:db8:1:2::a')).status).toBe(200);
    expect((await hit(app, '/api/own', '2001:db8:1:2::b')).status).toBe(429);
    expect(log.mock.calls[0][0]).toMatchObject({ ip: '2001:db8:1:2::b' });
    expect((await hit(app, '/api/own', '2001:db8:1:3::a')).status).toBe(200);
  });

  it('adds X-RateLimit headers and keys IPv4 by full address', async () => {
    const { app } = build(2);
    const first = await hit(app, '/api/own', '10.0.0.2');
    expect(first.headers.get('x-ratelimit-limit')).toBe('2');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('1');
    await hit(app, '/api/own', '10.0.0.2');
    expect((await hit(app, '/api/own', '10.0.0.2')).status).toBe(429);
    expect((await hit(app, '/api/own', '10.0.0.3')).status).toBe(200);
  });

  it('never limits excluded prefixes; enabled=false disables it', async () => {
    const { app, limiter } = build(1);
    for (let i = 0; i < 3; i++)
      expect((await hit(app, '/api/auth/session', '10.0.0.4')).status).toBe(200);
    await hit(app, '/api/own', '10.0.0.4');
    expect((await hit(app, '/api/own', '10.0.0.4')).status).toBe(429);
    limiter.configure({ enabled: false });
    expect((await hit(app, '/api/own', '10.0.0.4')).status).toBe(200);
  });

  it('runs before API-key verification (server/api/index.ts order)', async () => {
    const verify = spyOn(auth.api, 'verifyApiKey').mockResolvedValue({
      valid: false,
      error: { code: 'INVALID_API_KEY', message: 'invalid' },
      key: null,
    } as never);
    try {
      const limiter = new RateLimiter({ windowMs: 60_000, limit: 1 });
      const app = new Elysia({ prefix: '/api' })
        .use(apiErrorPlugin())
        .use(rateLimitPlugin(limiter, async () => {}))
        .use(apiKeyPlugin())
        .get('/posts', () => ({ ok: true }));
      const key = { 'x-api-key': `${API_KEY_PREFIX}bogus` };
      expect((await hit(app, '/api/posts', '10.0.0.9', key)).status).toBe(401);
      expect(verify).toHaveBeenCalledTimes(1);
      expect((await hit(app, '/api/posts', '10.0.0.9', key)).status).toBe(429);
      expect(verify).toHaveBeenCalledTimes(1);
    } finally {
      verify.mockRestore();
    }
  });
});

describe('RateLimiter episodes & memory bound', () => {
  it('flags episodeStart at most once per window', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 1 });
    expect(rl.check('e', 0).episodeStart).toBe(false);
    expect(rl.check('e', 100).episodeStart).toBe(true);
    expect(rl.check('e', 500).episodeStart).toBe(false);
    expect(rl.check('e', 1_050)).toMatchObject({ limited: true, episodeStart: false });
    expect(rl.check('e', 1_100).episodeStart).toBe(true); // a full window after the logged one
  });

  it('prune drops decayed keys and keeps an in-window episode', () => {
    const rl = new RateLimiter({ windowMs: 1_000, limit: 1 });
    rl.check('p', 0);
    rl.check('q', 1_500);
    rl.prune(2_000); // p: window 0 fully decayed; q: still weighted
    expect(rl.size).toBe(1);
    const ep = new RateLimiter({ windowMs: 1_000, limit: 1 });
    ep.check('k', 0);
    expect(ep.check('k', 1_900).episodeStart).toBe(true); // 0.1 + 1 > 1
    ep.prune(2_100); // counts are 0, episode at 1900 still inside the window
    expect(ep.size).toBe(1);
    ep.prune(2_901);
    expect(ep.size).toBe(0);
  });

  it('LRU: a recently used key survives eviction', () => {
    const rl = new RateLimiter({ windowMs: 60_000, limit: 1 }, 3);
    rl.check('a', 0);
    rl.check('b', 1);
    rl.check('c', 2);
    rl.check('a', 3); // touch → most recent (blocked)
    rl.check('d', 4); // evicts 'b'
    expect(rl.size).toBe(3);
    expect(rl.check('a', 5).limited).toBe(true); // counter kept
    expect(rl.check('b', 6).limited).toBe(false); // evicted → fresh quota
  });

  it('evicts a 10% LRU batch at the cap without a full prune', () => {
    const cap = 20;
    const rl = new RateLimiter({ windowMs: 60_000, limit: 1 }, cap);
    for (let i = 0; i < cap; i++) rl.check(`k${i}`, i);
    const prune = spyOn(rl, 'prune');
    rl.check('new', 100);
    expect(prune).not.toHaveBeenCalled();
    expect(rl.size).toBe(cap - 2 + 1);
    for (let i = 0; i < 50; i++) rl.check(`more${i}`, 200 + i);
    expect(rl.size).toBeLessThanOrEqual(cap);
    expect(prune).not.toHaveBeenCalled();
    expect(rl.check('more49', 300).limited).toBe(true); // newest survived
  });
});

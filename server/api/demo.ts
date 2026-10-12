/** Public demo entry: status + start a sandbox session (anonymous Better Auth user + seeded data). */
import { Elysia } from 'elysia';
import { auth } from '../auth';
import { seedDemo } from '../demo/seed';
import { logger } from '../logger';
import { resolveClientIp } from '../middleware/client-ip';
import { effectiveDemoTtlHours, getDemo } from '../settings-demo';

const START_LIMIT = 5;
const START_WINDOW_MS = 10 * 60_000;
const DEMO_HOME = '/app';

// ponytail: per-process memory window; move to a shared store if the app runs multiple instances.
const startWindows = new Map<string, { count: number; resetAt: number }>();

/** True when this IP may start another demo; counts the attempt. */
function takeStartSlot(ip: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  for (const [key, w] of startWindows) if (w.resetAt <= now) startWindows.delete(key);
  const w = startWindows.get(ip) ?? { count: 0, resetAt: now + START_WINDOW_MS };
  if (w.count >= START_LIMIT)
    return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  w.count += 1;
  startWindows.set(ip, w);
  return { ok: true, retryAfterSec: 0 };
}

export const demoApi = new Elysia({ prefix: '/demo' })
  .get('/', async () => {
    const s = await getDemo();
    return { enabled: s.enabled, ttlHours: effectiveDemoTtlHours(s) };
  })
  .post('/start', async ({ request, status, set }) => {
    if (!(await getDemo()).enabled)
      return status(404, { error: 'Demo sedang tidak tersedia.', code: 'DEMO_DISABLED' });

    const current = await auth.api.getSession({ headers: request.headers });
    if (current?.user.isAnonymous) return { redirect: DEMO_HOME };
    if (current)
      return status(409, {
        error: 'Kamu sudah masuk dengan akun. Keluar dulu untuk mencoba demo.',
        code: 'ALREADY_SIGNED_IN',
      });

    const slot = takeStartSlot(resolveClientIp(request.headers) ?? 'unknown');
    if (!slot.ok) {
      set.headers['retry-after'] = String(slot.retryAfterSec);
      return status(429, {
        error: 'Terlalu banyak percobaan demo dari jaringan ini. Coba lagi dalam beberapa menit.',
        code: 'DEMO_RATE_LIMITED',
      });
    }

    const { headers, response } = await auth.api.signInAnonymous({
      headers: request.headers,
      returnHeaders: true,
    });
    const userId = response.user.id;
    // A failed seed leaves an empty anonymous user; the TTL cleanup removes it.
    await seedDemo(userId).catch((err) => {
      throw new Error(`Failed to seed demo data for user ${userId}: ${(err as Error).message}`, {
        cause: err,
      });
    });
    logger.info({ userId }, 'demo session started');

    const res = Response.json(
      { redirect: DEMO_HOME },
      { headers: { 'cache-control': 'no-store' } },
    );
    for (const cookie of headers.getSetCookie()) res.headers.append('set-cookie', cookie);
    return res;
  });

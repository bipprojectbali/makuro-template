import { desc, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { db } from '../db';
import { post } from '../db/schema';
import { logger } from '../logger';
import { mcpPlugin } from '../mcp';
import { checkRateLimit, logRateLimit } from '../middleware/rate-limiter';
import { adminApi } from './admin';
import { analyticsApi } from './analytics';
import { settingsApi } from './settings';

/**
 * Resolve the current Better Auth session from request headers.
 * Returns null when unauthenticated.
 */
async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

/**
 * Main Elysia API. Everything here is served under `/api` (see mount in
 * server/app.ts). Better Auth owns `/api/auth/*`.
 */
export const api = new Elysia({ prefix: '/api' })
  // Mount Better Auth handler for all /api/auth/* routes.
  .mount(auth.handler)
  // Admin console endpoints (self-guarded by role).
  .use(adminApi)
  // MCP debug server at /api/mcp — protected by MCP_ADMIN_TOKEN bearer or query param.
  .use(mcpPlugin)
  // Analytics read endpoints (super-admin only).
  .use(analyticsApi)
  // App settings (GET public, PUT super-admin only).
  .use(settingsApi)
  // Derive the session for downstream handlers.
  .derive(async ({ request }) => {
    const s = await getSession(request.headers);
    return { user: s?.user ?? null, session: s?.session ?? null };
  })
  // Rate limiting + visitor tracking (fire-and-forget — must not block).
  .onBeforeHandle(async ({ request, user, status }) => {
    const url = new URL(request.url);
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    // Skip auth routes (Better Auth handles its own protection).
    if (!url.pathname.startsWith('/api/auth/')) {
      const { limited } = checkRateLimit(ip);
      if (limited) {
        void logRateLimit(ip === 'unknown' ? null : ip, url.pathname, (user as { id?: string } | null)?.id ?? null);
        return status(429, { error: 'Too many requests' });
      }
    }
  })
  .get('/hello', () => ({
    message: 'Hello from Elysia + Bun \u26a1',
    time: new Date().toISOString(),
  }))
  .get('/me', ({ user }) => ({ user }))
  .get('/posts', async () => {
    return db.select().from(post).orderBy(desc(post.createdAt)).limit(50);
  })
  .post(
    '/posts',
    async ({ user, body, status }) => {
      if (!user) return status(401, { error: 'Unauthorized' });
      const [created] = await db
        .insert(post)
        .values({ title: body.title, content: body.content ?? null, authorId: user.id })
        .returning();
      logger.info({ postId: created.id }, 'post created');
      return created;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        content: t.Optional(t.String()),
      }),
    },
  )
  .delete('/posts/:id', async ({ user, params, status }) => {
    if (!user) return status(401, { error: 'Unauthorized' });
    const [deleted] = await db.delete(post).where(eq(post.id, params.id)).returning();
    if (!deleted) return status(404, { error: 'Not found' });
    return { ok: true };
  });

export type Api = typeof api;

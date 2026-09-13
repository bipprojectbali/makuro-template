import { desc, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { db } from '../db';
import { post } from '../db/schema';
import { logger } from '../logger';
import { mcpPlugin } from '../mcp';
import { rateLimitPlugin } from '../middleware/rate-limiter';
import { applyRateLimitSettings } from '../settings';
import { adminApi } from './admin';
import { analyticsApi } from './analytics';
import { fileHealthApi } from './file-health';
import { settingsApi } from './settings';

/**
 * Resolve the current Better Auth session from request headers.
 * Returns null when unauthenticated.
 */
async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

// Load stored rate-limit overrides once per process (env defaults until then).
void applyRateLimitSettings();

/**
 * Main Elysia API. Everything here is served under `/api` (see mount in
 * server/app.ts). Better Auth owns `/api/auth/*`.
 */
export const api = new Elysia({ prefix: '/api' })
  // Rate limiting first: Elysia hooks only cover routes registered after them,
  // so this must precede every plugin (auth + mcp are excluded inside the plugin).
  .use(rateLimitPlugin())
  // Mount Better Auth handler for all /api/auth/* routes.
  .mount(auth.handler)
  // Admin console endpoints (self-guarded by role).
  .use(adminApi)
  // MCP debug server at /api/mcp — protected by MCP_ADMIN_TOKEN bearer or query param.
  .use(mcpPlugin)
  // Analytics read endpoints (super-admin only).
  .use(analyticsApi)
  // File health report (super-admin only).
  .use(fileHealthApi)
  // App settings (GET public, PUT super-admin only).
  .use(settingsApi)
  // Derive the session for downstream handlers.
  .derive(async ({ request }) => {
    const s = await getSession(request.headers);
    return { user: s?.user ?? null, session: s?.session ?? null };
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

import { Elysia } from 'elysia';
import { auth } from '../auth';
import { mcpPlugin } from '../mcp';
import { maintenancePlugin } from '../middleware/maintenance';
import { rateLimitPlugin } from '../middleware/rate-limiter';
import { applyRateLimitSettings } from '../settings';
import { startRetentionScheduler } from '../settings-retention';
import { adminApi } from './admin';
import { analyticsApi } from './analytics';
import { auditApi } from './audit';
import { fileHealthApi } from './file-health';
import { logsApi } from './logs';
import { meApi } from './me';
import { postsApi } from './posts';
import { sessionsApi } from './sessions';
import { settingsApi } from './settings';
import { settingsOpsApi } from './settings-ops';

/**
 * Resolve the current Better Auth session from request headers.
 * Returns null when unauthenticated.
 */
async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

// Load stored rate-limit overrides once per process (env defaults until then),
// and start the daily log-retention job.
void applyRateLimitSettings();
if (process.env.NODE_ENV !== 'test') startRetentionScheduler();

/**
 * Main Elysia API. Everything here is served under `/api` (see mount in
 * server/app.ts). Better Auth owns `/api/auth/*`.
 */
export const api = new Elysia({ prefix: '/api' })
  // Rate limiting first: Elysia hooks only cover routes registered after them,
  // so this must precede every plugin (auth + mcp are excluded inside the plugin).
  .use(rateLimitPlugin())
  // Maintenance mode: 503 for everyone but the allowed roles (auth routes exempt).
  .use(maintenancePlugin())
  // Mount Better Auth handler for all /api/auth/* routes.
  .mount(auth.handler)
  // Admin console endpoints (self-guarded by role).
  .use(adminApi)
  // MCP debug server at /api/mcp — protected by MCP_ADMIN_TOKEN bearer or query param.
  .use(mcpPlugin)
  // Analytics read endpoints (super-admin only).
  .use(analyticsApi)
  // Audit trail of privileged actions (super-admin only).
  .use(auditApi)
  // Cross-user session management (super-admin only).
  .use(sessionsApi)
  // File health report (super-admin only).
  .use(fileHealthApi)
  // Server log ring buffer (super-admin only).
  .use(logsApi)
  // App settings (GET public, PUT super-admin only).
  .use(settingsApi)
  .use(settingsOpsApi)
  // Current-user endpoints (profile page).
  .use(meApi)
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
  // Posts (public reads, session writes, admin moderation) live in posts.ts.
  .use(postsApi);

export type Api = typeof api;

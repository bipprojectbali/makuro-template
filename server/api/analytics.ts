/**
 * Analytics read/write endpoints for the super-admin /dev console.
 * All endpoints are protected by requireRole(SUPER_ADMIN).
 */
import { lt } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { loginLog, rateLimitLog, visitLog } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import { loginsApi } from './analytics-logins';
import { rateLimitsApi } from './analytics-ratelimits';
import { visitsApi } from './analytics-visits';

export { pageParams } from './analytics-paging';

export const analyticsApi = new Elysia({ prefix: '/analytics' })
  // Visitor logs live in analytics-visits.ts (list, stats, export, delete).
  .use(visitsApi)

  // Login logs live in analytics-logins.ts (list, stats, export, delete).
  .use(loginsApi)

  // Rate-limit logs live in analytics-ratelimits.ts (list, stats, export, delete).
  .use(rateLimitsApi)

  // ── Bulk purge (all tables, older than N days) ────────────────────────────

  .delete(
    '/purge',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const days = Math.min(Math.max(0, Number(query.days ?? 30)), 365);
      // days=0 means "delete all" — no date filter applied
      const cutoff = days === 0 ? null : new Date(Date.now() - days * 86_400_000);
      const [v, l, r] = await Promise.all([
        db
          .delete(visitLog)
          .where(cutoff ? lt(visitLog.createdAt, cutoff) : undefined)
          .returning({ id: visitLog.id }),
        db
          .delete(loginLog)
          .where(cutoff ? lt(loginLog.createdAt, cutoff) : undefined)
          .returning({ id: loginLog.id }),
        db
          .delete(rateLimitLog)
          .where(cutoff ? lt(rateLimitLog.createdAt, cutoff) : undefined)
          .returning({ id: rateLimitLog.id }),
      ]);
      return { purgedVisits: v.length, purgedLogins: l.length, purgedRateLimits: r.length };
    },
    { query: t.Object({ days: t.Optional(t.String()) }) },
  );

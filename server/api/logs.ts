/** Server log endpoints for the super-admin console (/dev/server-logs). Reads the in-memory ring buffer. */
import { Elysia, t } from 'elysia';
import { requireRole } from '../guard';
import { LEVEL_NAMES, LEVEL_NUMBERS, logBuffer } from '../mcp/log-buffer';
import { ROLES } from '../permissions';

const MAX_LIMIT = 500;
const HOUR_MS = 3_600_000;

export const logsApi = new Elysia({ prefix: '/logs' })
  .get(
    '/',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const limit = Math.min(Math.max(1, Number(query.limit ?? 200) || 200), MAX_LIMIT);
      const since = query.since ? Date.parse(query.since) : undefined;
      const rows = logBuffer.query({
        limit,
        level: query.level && query.level in LEVEL_NUMBERS ? query.level : undefined,
        search: query.search?.trim() || undefined,
        since: since && !Number.isNaN(since) ? since : undefined,
      });
      // Newest first for the console.
      return {
        rows: rows
          .slice()
          .reverse()
          .map((e) => ({ ...e, levelName: LEVEL_NAMES[e.level] ?? String(e.level) })),
        buffered: logBuffer.size(),
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        level: t.Optional(t.String()),
        search: t.Optional(t.String()),
        since: t.Optional(t.String()),
      }),
    },
  )
  .get('/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const now = Date.now();
    return {
      ...logBuffer.stats(),
      errorsLastHour: logBuffer.countSince(LEVEL_NUMBERS.error, now - HOUR_MS),
      warningsLastHour:
        logBuffer.countSince(LEVEL_NUMBERS.warn, now - HOUR_MS) -
        logBuffer.countSince(LEVEL_NUMBERS.error, now - HOUR_MS),
    };
  });

/** Errors in the last hour — sidebar badge. */
export function errorsLastHour(now = Date.now()): number {
  return logBuffer.countSince(LEVEL_NUMBERS.error, now - HOUR_MS);
}

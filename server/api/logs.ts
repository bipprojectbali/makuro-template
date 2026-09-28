/** Server log endpoints for the super-admin console (/dev/server-logs). Reads the in-memory ring buffer. */
import { Elysia, t } from 'elysia';
import { requireRole } from '../guard';
import {
  LEVEL_NAMES,
  LEVEL_NUMBERS,
  type LogEntry,
  type LogFilter,
  logBuffer,
} from '../mcp/log-buffer';
import { ROLES } from '../permissions';

const MAX_LIMIT = 500;
const HOUR_MS = 3_600_000;
// Below Bun.serve idleTimeout (60s in prod.ts) so idle streams are not cut.
const HEARTBEAT_MS = 20_000;
const RECONNECT_MS = 3_000;

const withLevelName = (e: LogEntry) => ({
  ...e,
  levelName: LEVEL_NAMES[e.level] ?? String(e.level),
});
const levelFilter = (level?: string) => (level && level in LEVEL_NUMBERS ? level : undefined);

/**
 * SSE of new log entries matching `filter`. Each event id is the entry seq, so a
 * reconnecting EventSource (Last-Event-ID) resumes from the buffer without gaps.
 */
function logStream(filter: LogFilter): Response {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (text: string) => ctrl.enqueue(enc.encode(text));
      const sendEntry = (e: LogEntry) =>
        send(`id: ${e.seq}\ndata: ${JSON.stringify(withLevelName(e))}\n\n`);
      send(`retry: ${RECONNECT_MS}\n\n`);
      for (const e of logBuffer.query({ ...filter, limit: MAX_LIMIT })) sendEntry(e);
      const unsubscribe = logBuffer.subscribe((e) => {
        if (logBuffer.matches(e, filter)) sendEntry(e);
      });
      const ping = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
    },
    // Runs when the client disconnects (Bun.serve, and the dev bridge on res close).
    cancel() {
      cleanup();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const logsApi = new Elysia({ prefix: '/logs' })
  .get(
    '/',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const limit = Math.min(Math.max(1, Number(query.limit ?? 200) || 200), MAX_LIMIT);
      const since = query.since ? Date.parse(query.since) : undefined;
      const rows = logBuffer.query({
        limit,
        level: levelFilter(query.level),
        search: query.search?.trim() || undefined,
        since: since && !Number.isNaN(since) ? since : undefined,
      });
      // Newest first for the console.
      return {
        rows: rows.slice().reverse().map(withLevelName),
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
  .get(
    '/stream',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      // A reconnecting EventSource sends Last-Event-ID; the first connect passes ?after=.
      const after = Number(request.headers.get('last-event-id') ?? query.after) || 0;
      return logStream({
        level: levelFilter(query.level),
        search: query.search?.trim() || undefined,
        after,
      });
    },
    {
      query: t.Object({
        level: t.Optional(t.String()),
        search: t.Optional(t.String()),
        after: t.Optional(t.String()),
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

/** Warnings (excluding errors) in the last hour — sidebar badge when there are no errors. */
export function warningsLastHour(now = Date.now()): number {
  return (
    logBuffer.countSince(LEVEL_NUMBERS.warn, now - HOUR_MS) -
    logBuffer.countSince(LEVEL_NUMBERS.error, now - HOUR_MS)
  );
}

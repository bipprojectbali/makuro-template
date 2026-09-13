/**
 * File health endpoints for the super-admin console (/dev/file-health).
 * Reports file sizes vs. the project's line limits and flags files that would
 * blow up an AI agent's context window if read whole.
 */
import { Elysia, t } from 'elysia';
import { filterEntries } from '../file-health/file-health.filter';
import type { ContextHazard, FileKind, HealthStatus } from '../file-health/file-health.rules';
import {
  HARD_LIMIT_CHARS,
  HARD_LIMIT_LINES,
  HAZARD_CAUTION_TOKENS,
  HAZARD_DANGER_TOKENS,
  KIND_LIMITS,
} from '../file-health/file-health.rules';
import { scanFileHealth } from '../file-health/file-health.scan';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export const fileHealthApi = new Elysia({ prefix: '/file-health' })
  .get(
    '/',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const report = await scanFileHealth({ refresh: query.refresh === 'true' });
      const rows = filterEntries(report.files, {
        status: query.status as HealthStatus | undefined,
        kind: query.kind as FileKind | undefined,
        hazard: query.hazard as ContextHazard | undefined,
        search: query.search,
        sort: query.sort as 'ratio' | 'lines' | 'tokens' | 'path' | undefined,
      });
      const page = Math.max(1, Number(query.page ?? 1));
      const limit = Math.min(Math.max(1, Number(query.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
      const offset = (page - 1) * limit;
      return {
        available: report.available,
        reason: report.reason,
        root: report.root,
        scannedAt: report.scannedAt,
        durationMs: report.durationMs,
        summary: report.summary,
        rules: {
          kindLimits: KIND_LIMITS,
          hardLimitLines: HARD_LIMIT_LINES,
          hardLimitChars: HARD_LIMIT_CHARS,
          cautionTokens: HAZARD_CAUTION_TOKENS,
          dangerTokens: HAZARD_DANGER_TOKENS,
        },
        rows: rows.slice(offset, offset + limit),
        total: rows.length,
        page,
        limit,
      };
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        kind: t.Optional(t.String()),
        hazard: t.Optional(t.String()),
        search: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        refresh: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/file',
    async ({ request, query, status }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const report = await scanFileHealth();
      const rel = query.path.replace(/^\.?\//, '');
      const entry = report.files.find((f) => f.path === rel);
      if (!entry) return status(404, { error: `File ${rel} tidak ditemukan dalam hasil scan` });
      return entry;
    },
    { query: t.Object({ path: t.String({ minLength: 1 }) }) },
  );

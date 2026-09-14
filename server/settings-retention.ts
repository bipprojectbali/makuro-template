/**
 * Log retention: per-table max age in days (NULL = keep forever) plus a daily
 * scheduler that purges expired rows and records what it did.
 */
import { lt } from 'drizzle-orm';
import { AUDIT_ACTIONS, audit } from './audit';
import { db } from './db';
import { apiKeyUsage, auditLog, loginLog, rateLimitLog, visitLog } from './db/schema';
import { logger } from './logger';
import { readSettingsRow, type SettingsRow, upsertSettingsRow } from './settings.core';

export type RetentionSettings = {
  visitDays: number | null;
  loginDays: number | null;
  rateLimitDays: number | null;
  auditDays: number | null;
  apiUsageDays: number | null;
};
export type RetentionResult = {
  ranAt: string;
  deleted: Record<keyof RetentionSettings, number>;
  trigger: 'schedule' | 'manual';
};
export type RetentionState = RetentionSettings & {
  lastRunAt: string | null;
  lastResult: RetentionResult | null;
};

export const RETENTION_MIN_DAYS = 1;
export const RETENTION_MAX_DAYS = 3650;
const DAY_MS = 86_400_000;
const CHECK_INTERVAL_MS = 60 * 60_000;

export function parseRetention(row: SettingsRow | null): RetentionState {
  return {
    visitDays: row?.retentionVisitDays ?? null,
    loginDays: row?.retentionLoginDays ?? null,
    rateLimitDays: row?.retentionRateLimitDays ?? null,
    auditDays: row?.retentionAuditDays ?? null,
    apiUsageDays: row?.retentionApiUsageDays ?? null,
    lastRunAt: row?.retentionLastRunAt ? row.retentionLastRunAt.toISOString() : null,
    lastResult: (row?.retentionLastResult as RetentionResult | null) ?? null,
  };
}

export async function getRetention(): Promise<RetentionState> {
  return parseRetention(await readSettingsRow());
}

export async function upsertRetention(s: RetentionSettings): Promise<RetentionState> {
  await upsertSettingsRow({
    retentionVisitDays: s.visitDays,
    retentionLoginDays: s.loginDays,
    retentionRateLimitDays: s.rateLimitDays,
    retentionAuditDays: s.auditDays,
    retentionApiUsageDays: s.apiUsageDays,
  });
  return parseRetention(await readSettingsRow());
}

const TABLES = {
  visitDays: visitLog,
  loginDays: loginLog,
  rateLimitDays: rateLimitLog,
  auditDays: auditLog,
  apiUsageDays: apiKeyUsage,
} as const;

/** Delete rows older than each configured age. Tables with NULL retention are untouched. */
export async function runRetention(
  trigger: RetentionResult['trigger'] = 'schedule',
  now = Date.now(),
): Promise<RetentionResult> {
  const s = await getRetention();
  const deleted = { visitDays: 0, loginDays: 0, rateLimitDays: 0, auditDays: 0, apiUsageDays: 0 };
  for (const key of Object.keys(TABLES) as Array<keyof typeof TABLES>) {
    const days = s[key];
    if (!days) continue;
    const table = TABLES[key];
    const rows = await db
      .delete(table)
      .where(lt(table.createdAt, new Date(now - days * DAY_MS)))
      .returning({ id: table.id });
    deleted[key] = rows.length;
  }
  const result: RetentionResult = { ranAt: new Date(now).toISOString(), deleted, trigger };
  await upsertSettingsRow({ retentionLastRunAt: new Date(now), retentionLastResult: result });
  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  if (total > 0) {
    void audit({
      actor: null,
      action: AUDIT_ACTIONS.LOGS_RETENTION,
      targetType: 'logs',
      summary: `Retensi otomatis menghapus ${total} baris log (${trigger})`,
      meta: result,
    });
  }
  return result;
}

/** Runs at most once per day; checked hourly. Safe to call once at boot. */
export function startRetentionScheduler(): void {
  const tick = async () => {
    try {
      const s = await getRetention();
      const configured =
        s.visitDays || s.loginDays || s.rateLimitDays || s.auditDays || s.apiUsageDays;
      if (!configured) return;
      const last = s.lastRunAt ? Date.parse(s.lastRunAt) : 0;
      if (Date.now() - last < DAY_MS) return;
      await runRetention('schedule');
    } catch (err) {
      logger.warn({ err }, 'retention scheduler failed');
    }
  };
  setInterval(tick, CHECK_INTERVAL_MS).unref?.();
  setTimeout(tick, 15_000).unref?.();
}

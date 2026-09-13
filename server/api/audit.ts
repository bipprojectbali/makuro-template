/** Audit log endpoints (super-admin). Read-only by design: the trail is never edited or deleted from the console. */
import { desc, eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { db } from '../db';
import { auditLog, user } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  AuditListQuery,
  auditSelect,
  auditStats,
  buildAuditWhere,
  listAudit,
  toAuditCsv,
} from './audit.query';

export const AUDIT_EXPORT_MAX_ROWS = 10_000;

export const auditApi = new Elysia({ prefix: '/audit' })
  .get(
    '/',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return listAudit(query);
    },
    { query: AuditListQuery },
  )
  .get('/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return auditStats();
  })
  .get(
    '/export',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const rows = await db
        .select(auditSelect)
        .from(auditLog)
        .leftJoin(user, eq(auditLog.actorId, user.id))
        .where(buildAuditWhere(query))
        .orderBy(desc(auditLog.createdAt))
        .limit(AUDIT_EXPORT_MAX_ROWS);
      const date = new Date().toISOString().slice(0, 10);
      return new Response(toAuditCsv(rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="audit-log-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    },
    { query: AuditListQuery },
  );

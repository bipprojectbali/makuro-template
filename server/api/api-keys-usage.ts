/** Cross-key API usage log (super-admin): filtered list + CSV export. Mounted before /api-keys/:id. */
import { Elysia } from 'elysia';
import { exportUsage, listUsage, UsageListQuery, usageToCsv } from '../api-keys/usage.query';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';

export const apiKeysUsageApi = new Elysia({ prefix: '/api-keys/usage' })
  .get(
    '/',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return listUsage(query);
    },
    { query: UsageListQuery },
  )
  .get(
    '/export',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const rows = await exportUsage(query);
      const date = new Date().toISOString().slice(0, 10);
      return new Response(usageToCsv(rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="api-key-usage-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    },
    { query: UsageListQuery },
  );

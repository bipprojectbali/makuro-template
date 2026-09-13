/**
 * Aggregates the numbers the /dev overview page shows at first paint. Every
 * source is independent, so they run in parallel; a failing optional source
 * (file health scan) degrades to null instead of breaking the page.
 */

import { adminUserStats } from './api/admin-users.query';
import { listLogins } from './api/analytics-logins.query';
import { getLoginStats } from './api/analytics-logins.stats.query';
import { listRateLimits } from './api/analytics-ratelimits.query';
import { getRateLimitStats } from './api/analytics-ratelimits.stats.query';
import { getVisitStats } from './api/analytics-visits.stats.query';
import { scanFileHealth } from './file-health/file-health.scan';
import { settingsOverview } from './settings';

const RECENT = 5;

export async function devOverview() {
  const [users, visits, logins, rateLimits, fileHealth, settings, recentLogins, recentBlocks] =
    await Promise.all([
      adminUserStats(),
      getVisitStats(),
      getLoginStats(),
      getRateLimitStats(),
      scanFileHealth()
        .then((r) => (r.available ? r.summary : null))
        .catch(() => null),
      settingsOverview(),
      listLogins({ limit: String(RECENT) }),
      listRateLimits({ limit: String(RECENT) }),
    ]);
  return {
    generatedAt: new Date().toISOString(),
    users,
    visits: {
      total: visits.total,
      last24h: visits.last24h,
      last7d: visits.last7d,
      bots: visits.bots,
      uniqueIps: visits.uniqueIps,
    },
    logins: {
      total: logins.total,
      last24h: logins.last24h,
      last7d: logins.last7d,
      uniqueUsers: logins.uniqueUsers,
    },
    rateLimits: {
      total: rateLimits.total,
      last1h: rateLimits.last1h,
      last24h: rateLimits.last24h,
      config: rateLimits.config,
    },
    fileHealth,
    settings: settings.settings,
    runtime: settings.runtime,
    recentLogins: recentLogins.rows,
    recentBlocks: recentBlocks.rows,
  };
}

export type DevOverview = Awaited<ReturnType<typeof devOverview>>;

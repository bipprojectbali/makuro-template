/** Operational endpoints for /dev/tools: process status, MCP catalog, cache resets (super-admin). */
import { sql } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { APP_VERSION } from '../app-info';
import { AUDIT_ACTIONS, audit } from '../audit';
import { db } from '../db';
import { env } from '../env';
import { resetFileHealthCache } from '../file-health/file-health.scan';
import { requireRole } from '../guard';
import { logBuffer } from '../mcp/log-buffer';
import { MCP_TOOL_CATALOG } from '../mcp/tool-catalog';
import { rateLimiter } from '../middleware/rate-limiter';
import { ROLES } from '../permissions';
import { invalidateSettingsCache } from '../settings.core';

const startedAt = Date.now();

export const RESET_TARGETS = {
  limiter: {
    label: 'Rate limiter',
    description: 'Kosongkan hitungan request semua IP.',
    run: () => rateLimiter.reset(),
  },
  'file-health': {
    label: 'Cache file health',
    description: 'Paksa scan ulang pada permintaan berikutnya.',
    run: () => resetFileHealthCache(),
  },
  settings: {
    label: 'Cache settings',
    description: 'Baca ulang baris app_setting dari database.',
    run: () => invalidateSettingsCache(),
  },
  logs: {
    label: 'Buffer log server',
    description: 'Kosongkan ring buffer log di memori.',
    run: () => logBuffer.clear(),
  },
} as const;
export type ResetTarget = keyof typeof RESET_TARGETS;

export const opsApi = new Elysia({ prefix: '/ops' })
  .get('/status', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const t0 = performance.now();
    await db.execute(sql`select 1`);
    const dbLatencyMs = Math.round((performance.now() - t0) * 10) / 10;
    const mem = process.memoryUsage();
    return {
      env: env.NODE_ENV,
      version: APP_VERSION,
      bun: Bun.version,
      standalone: Bun.isStandaloneExecutable,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1048576),
        rssMb: Math.round(mem.rss / 1048576),
      },
      dbLatencyMs,
      limiter: { trackedClients: rateLimiter.size, enabled: rateLimiter.config.enabled },
      logBuffer: { size: logBuffer.size(), capacity: logBuffer.maxSize },
    };
  })
  .get('/mcp', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return {
      // API keys with the `mcp` scope always work; the env token is the legacy path.
      enabled: true,
      legacyTokenEnabled: Boolean(env.MCP_ADMIN_TOKEN),
      endpoint: `${env.APP_URL}/api/mcp`,
      tools: MCP_TOOL_CATALOG,
      /** Never a secret itself — only how to supply it. */
      auth: {
        header: 'Authorization: Bearer <API key dengan scope mcp>',
        scope: 'mcp',
        legacyQuery: 'mcpAdminToken',
        legacyEnvVar: 'MCP_ADMIN_TOKEN',
      },
    };
  })
  .get('/reset-targets', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return Object.entries(RESET_TARGETS).map(([key, v]) => ({
      key,
      label: v.label,
      description: v.description,
    }));
  })
  .post('/reset/:target', async ({ request, params, status }) => {
    const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
    const target = RESET_TARGETS[params.target as ResetTarget];
    if (!target) return status(404, { error: 'Target tidak dikenal' });
    target.run();
    void audit({
      actor: user,
      headers: request.headers,
      action: AUDIT_ACTIONS.OPS_RESET,
      targetType: 'settings',
      targetId: params.target,
      summary: `Reset: ${target.label}`,
    });
    return { ok: true, target: params.target };
  });

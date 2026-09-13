import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { filterEntries } from '../../file-health/file-health.filter';
import type { HealthStatus } from '../../file-health/file-health.rules';
import { scanFileHealth } from '../../file-health/file-health.scan';

export type FileHealthToolArgs = { path?: string; status?: 'warn' | 'over'; limit?: number };

const DEFAULT_LIMIT = 20;

/** Pure report builder (unit-tested) — the MCP tool just serializes this. */
export async function fileHealthReport(args: FileHealthToolArgs, root?: string) {
  const report = await scanFileHealth(root ? { root } : {});
  if (!report.available) return { available: false, reason: report.reason };

  if (args.path) {
    const rel = args.path.replace(/^\.?\//, '');
    const entry = report.files.find((f) => f.path === rel);
    if (!entry)
      return {
        available: true,
        found: false,
        path: rel,
        hint: 'Path harus relatif terhadap root project.',
      };
    return { available: true, found: true, file: entry };
  }

  const limit = args.limit ?? DEFAULT_LIMIT;
  const pick = (status: HealthStatus) => filterEntries(report.files, { status }).slice(0, limit);
  const hazards = report.files
    .filter((f) => f.hazard !== 'none')
    .sort((a, b) => b.estTokens - a.estTokens)
    .slice(0, limit)
    .map(({ path, estTokens, hazard, advice }) => ({ path, estTokens, hazard, advice }));

  const compact = (f: (typeof report.files)[number]) => ({
    path: f.path,
    kind: f.kind,
    lines: f.lines,
    limit: f.limit,
    estTokens: f.estTokens,
    hardLimitViolation: f.hardLimitViolation,
  });

  return {
    available: true,
    scannedAt: report.scannedAt,
    summary: report.summary,
    over: args.status === 'warn' ? [] : pick('over').map(compact),
    warn: args.status === 'over' ? [] : pick('warn').map(compact),
    contextHazards: hazards,
  };
}

export function registerFileHealthTool(server: McpServer) {
  server.registerTool(
    'check_file_health',
    {
      description:
        'Check repository file health before reading or editing files. Without `path`: summary, files over/near their line limits, and files large enough to blow up an agent context window (with token estimates). With `path`: metrics and read advice for that one file. Call this before reading an unfamiliar file.',
      inputSchema: {
        path: z.string().optional().describe('Repo-relative path, e.g. "server/api/admin.ts"'),
        status: z.enum(['warn', 'over']).optional().describe('Only list files with this status'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Max entries per list (default 20)'),
      },
    },
    async (args) => ({
      content: [
        { type: 'text' as const, text: JSON.stringify(await fileHealthReport(args), null, 2) },
      ],
    }),
  );
}

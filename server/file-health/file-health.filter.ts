/** Filtering/sorting of scan results shared by the REST API and the MCP tool. */
import type { ContextHazard, FileKind, HealthStatus } from './file-health.rules';
import type { FileHealthEntry } from './file-health.scan';

export type FileHealthFilter = {
  status?: HealthStatus;
  kind?: FileKind;
  hazard?: ContextHazard;
  search?: string;
  /** default: worst first (ratio desc, then tokens desc) */
  sort?: 'ratio' | 'lines' | 'tokens' | 'path';
};

const STATUS_RANK: Record<HealthStatus, number> = { over: 0, warn: 1, ok: 2, excluded: 3 };

export function filterEntries(files: FileHealthEntry[], f: FileHealthFilter): FileHealthEntry[] {
  const q = f.search?.trim().toLowerCase();
  const out = files.filter(
    (e) =>
      (!f.status || e.status === f.status) &&
      (!f.kind || e.kind === f.kind) &&
      (!f.hazard || e.hazard === f.hazard) &&
      (!q || e.path.toLowerCase().includes(q)),
  );
  const sort = f.sort ?? 'ratio';
  out.sort((a, b) => {
    if (sort === 'path') return a.path.localeCompare(b.path);
    if (sort === 'lines') return b.lines - a.lines;
    if (sort === 'tokens') return b.estTokens - a.estTokens;
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    return (b.ratio ?? 0) - (a.ratio ?? 0) || b.estTokens - a.estTokens;
  });
  return out;
}

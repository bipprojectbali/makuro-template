/**
 * Repository scanner behind /dev/file-health and the `check_file_health` MCP tool.
 * Streams every text file (bounded memory regardless of file size), classifies
 * it, and scores it against line limits and agent-context hazards. Results are
 * cached briefly because the console polls this on every filter change.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  adviceFor,
  type ContextHazard,
  classifyFile,
  estimateTokens,
  type FileKind,
  HARD_LIMIT_CHARS,
  HARD_LIMIT_LINES,
  type HealthStatus,
  hazardFor,
  IGNORED_DIRS,
  isTextFile,
  KIND_LIMITS,
  statusFor,
} from './file-health.rules';

export type FileHealthEntry = {
  path: string;
  kind: FileKind;
  lines: number;
  chars: number;
  bytes: number;
  estTokens: number;
  limit: number | null;
  /** lines / limit, null when the kind has no limit */
  ratio: number | null;
  status: HealthStatus;
  hardLimitViolation: boolean;
  hazard: ContextHazard;
  advice: string;
};

export type FileHealthSummary = {
  scanned: number;
  ok: number;
  warn: number;
  over: number;
  excluded: number;
  hardViolations: number;
  caution: number;
  danger: number;
  totalTokens: number;
  byKind: Array<{ kind: FileKind; count: number; over: number; warn: number }>;
};

export type FileHealthReport = {
  available: boolean;
  reason?: string;
  root: string;
  scannedAt: string;
  durationMs: number;
  summary: FileHealthSummary;
  files: FileHealthEntry[];
};

const CACHE_TTL_MS = 30_000;
let cache: { report: FileHealthReport; expires: number } | null = null;

async function listTextFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name)) await walk(path.join(dir, e.name));
        continue;
      }
      if (!e.isFile()) continue;
      const rel = path.relative(root, path.join(dir, e.name)).split(path.sep).join('/');
      if (isTextFile(rel)) out.push(rel);
    }
  };
  await walk(root);
  return out.sort();
}

/** Count lines/chars by streaming — never holds the whole file in memory. */
export async function measureFile(
  absPath: string,
): Promise<{ lines: number; chars: number; bytes: number }> {
  const file = Bun.file(absPath);
  const decoder = new TextDecoder();
  let lines = 0;
  let chars = 0;
  let lastChar = '';
  for await (const chunk of file.stream()) {
    const text = decoder.decode(chunk, { stream: true });
    chars += text.length;
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
    if (text) lastChar = text[text.length - 1];
  }
  // A final line without trailing newline still counts.
  if (chars > 0 && lastChar !== '\n') lines++;
  return { lines, chars, bytes: file.size };
}

export function buildEntry(
  rel: string,
  m: { lines: number; chars: number; bytes: number },
): FileHealthEntry {
  const kind = classifyFile(rel);
  const limit = KIND_LIMITS[kind];
  const estTokens = estimateTokens(m.chars);
  const hazard = hazardFor(estTokens);
  return {
    path: rel,
    kind,
    lines: m.lines,
    chars: m.chars,
    bytes: m.bytes,
    estTokens,
    limit,
    ratio: limit ? Math.round((m.lines / limit) * 100) / 100 : null,
    status: statusFor(kind, m.lines, m.chars),
    hardLimitViolation:
      kind !== 'excluded' && (m.lines > HARD_LIMIT_LINES || m.chars > HARD_LIMIT_CHARS),
    hazard,
    advice: adviceFor(hazard, estTokens),
  };
}

export function summarize(files: FileHealthEntry[]): FileHealthSummary {
  const byKind = new Map<FileKind, { kind: FileKind; count: number; over: number; warn: number }>();
  const s: FileHealthSummary = {
    scanned: files.length,
    ok: 0,
    warn: 0,
    over: 0,
    excluded: 0,
    hardViolations: 0,
    caution: 0,
    danger: 0,
    totalTokens: 0,
    byKind: [],
  };
  for (const f of files) {
    s[f.status]++;
    if (f.hardLimitViolation) s.hardViolations++;
    if (f.hazard === 'caution') s.caution++;
    if (f.hazard === 'danger') s.danger++;
    s.totalTokens += f.estTokens;
    const k = byKind.get(f.kind) ?? { kind: f.kind, count: 0, over: 0, warn: 0 };
    k.count++;
    if (f.status === 'over') k.over++;
    if (f.status === 'warn') k.warn++;
    byKind.set(f.kind, k);
  }
  s.byKind = [...byKind.values()].sort((a, b) => b.count - a.count);
  return s;
}

async function isProjectRoot(root: string): Promise<boolean> {
  const [app, server] = await Promise.all([
    Bun.file(path.join(root, 'package.json')).exists(),
    readdir(path.join(root, 'server')).then(
      () => true,
      () => false,
    ),
  ]);
  return app && server;
}

export type ScanOptions = { root?: string; refresh?: boolean };

/** Scan the project (default: process.cwd()). Cached for 30s unless `refresh`. */
export async function scanFileHealth(opts: ScanOptions = {}): Promise<FileHealthReport> {
  const root = opts.root ?? process.cwd();
  const useCache = !opts.root && !opts.refresh;
  if (useCache && cache && cache.expires > Date.now()) return cache.report;

  const started = Date.now();
  const base = {
    root,
    scannedAt: new Date().toISOString(),
    summary: summarize([]),
    files: [] as FileHealthEntry[],
  };

  if (Bun.isStandaloneExecutable) {
    return {
      ...base,
      available: false,
      reason: 'Kode sumber tidak tersedia di binary terkompilasi.',
      durationMs: 0,
    };
  }
  if (!(await isProjectRoot(root))) {
    return {
      ...base,
      available: false,
      reason: `Direktori kerja ${root} bukan root project (tidak ada package.json + server/).`,
      durationMs: 0,
    };
  }

  const rels = await listTextFiles(root);
  const files: FileHealthEntry[] = [];
  for (const rel of rels) {
    try {
      files.push(buildEntry(rel, await measureFile(path.join(root, rel))));
    } catch (err) {
      // A file removed mid-scan or unreadable — skip it but keep the report useful.
      files.push(buildEntry(rel, { lines: 0, chars: 0, bytes: 0 }));
      files[files.length - 1].advice = `Tidak bisa dibaca: ${(err as Error).message}`;
    }
  }

  const report: FileHealthReport = {
    ...base,
    available: true,
    durationMs: Date.now() - started,
    summary: summarize(files),
    files,
  };
  if (!opts.root) cache = { report, expires: Date.now() + CACHE_TTL_MS };
  return report;
}

/** Test/ops helper: drop the in-memory cache. */
export function resetFileHealthCache(): void {
  cache = null;
}

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Glob } from 'bun';

const ROOT = path.join(import.meta.dir, '..');
const IMPORT_RE = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g;
// Anything here throws in the browser bundle (e.g. `process is not defined`).
const SERVER_ONLY_SPEC = /(^node:|\/env$|\/db$|\/app-info$|\/logger$)/;
const SERVER_ONLY_CODE = /\bBun\.|\bprocess\./;

function runtimeImports(src: string): string[] {
  const out: string[] = [];
  for (const [, typeOnly, names, spec] of src.matchAll(IMPORT_RE)) {
    const allTypes = names.split(',').every((n) => !n.trim() || n.trim().startsWith('type '));
    if (!typeOnly && !allTypes) out.push(spec);
  }
  return out;
}

/** Server-only code reachable from a server module through its relative runtime imports. */
function serverOnly(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  const name = path.relative(ROOT, file);
  const found = SERVER_ONLY_CODE.test(src) ? [`${name} uses Bun/process`] : [];
  for (const spec of runtimeImports(src)) {
    if (SERVER_ONLY_SPEC.test(spec)) found.push(`${name} imports ${spec}`);
    else if (spec.startsWith('.'))
      found.push(...serverOnly(`${path.resolve(path.dirname(file), spec)}.ts`, seen));
  }
  return found;
}

describe('client code imports only pure @server modules', () => {
  it('app/components and app/lib pull no env/db/node/Bun code into the browser', () => {
    const offenders: string[] = [];
    for (const rel of new Glob('app/{components,lib}/**/*.{ts,tsx}').scanSync(ROOT)) {
      for (const spec of runtimeImports(readFileSync(path.join(ROOT, rel), 'utf8'))) {
        if (!spec.startsWith('@server/')) continue;
        const target = path.join(ROOT, 'server', `${spec.slice('@server/'.length)}.ts`);
        offenders.push(...serverOnly(target).map((o) => `${rel} → ${o}`));
      }
    }
    expect(offenders).toEqual([]);
  });
});

/** `doctor [--json]`: print health checks, exit 1 when any check fails. */
import { parseArgs } from 'node:util';
import { type Check, collectChecks } from './doctor.checks';

const ICON = { ok: '✅', warn: '⚠️ ', fail: '❌' } as const;

/** Human-readable table grouped by Check.group. */
export function formatChecks(checks: Check[]): string {
  const lines: string[] = [];
  let group = '';
  for (const c of checks) {
    if (c.group !== group) {
      group = c.group;
      lines.push('', group);
    }
    lines.push(
      `  ${ICON[c.status]} ${c.name.padEnd(20)} ${c.detail}${c.hint ? `  → ${c.hint}` : ''}`,
    );
  }
  return lines.join('\n').trimStart();
}

/** CLI entry. */
export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { json: { type: 'boolean', default: false } },
  });
  const checks = await collectChecks({ env: process.env, cwd: process.cwd() });
  const ok = !checks.some((c) => c.status === 'fail');
  console.log(values.json ? JSON.stringify({ ok, checks }, null, 2) : formatChecks(checks));
  return ok ? 0 : 1;
}

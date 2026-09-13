/** Pure display helpers for the DB schema console (tested in tests/db-schema-format.test.ts). */
import type { ColumnMeta } from '@server/db/schema-introspect';

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString('id-ID', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}

/** "cascade" → "Cascade", "set null" → "Set null", "no action" → "No action". */
export function onDeleteLabel(v: string | undefined): string {
  if (!v) return '—';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** Default column text for tables/drawers. */
export function defaultLabel(col: Pick<ColumnMeta, 'defaultKind' | 'defaultText'>): string {
  if (col.defaultKind === 'fn') return 'dibuat aplikasi';
  if (col.defaultKind === null) return '—';
  return col.defaultText ?? 'sql';
}

/** One-line signature used in the drawer header: "text · PK" / "text? · FK → user.id". */
export function columnSignature(col: ColumnMeta): string {
  const parts = [`${col.type}${col.notNull ? '' : '?'}`];
  if (col.pk) parts.push('PK');
  if (col.fkTable) parts.push(`FK → ${col.fkTable}.${col.fkColumn}`);
  if (col.unique) parts.push('unique');
  return parts.join(' · ');
}

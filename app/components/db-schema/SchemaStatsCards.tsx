import type { SchemaGraph } from '@server/db/schema-introspect';
import type { SchemaStats } from '@server/db/schema-stats';
import { FiColumns, FiDatabase, FiGitMerge, FiHardDrive, FiLayers, FiList } from 'react-icons/fi';
import { fmtBytes } from '~/lib/db-schema-format';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

/** Tables, columns, relations, indexes, rows, size, and migration state. */
export function SchemaStatsCards({ schema, stats }: { schema: SchemaGraph; stats: SchemaStats }) {
  const columns = schema.tables.reduce((n, t) => n + t.columns.length, 0);
  const indexes = schema.tables.reduce((n, t) => n + t.indexes.length, 0);
  const rows = stats.tables.reduce((n, t) => n + t.rows, 0);
  const bytes = stats.tables.reduce((n, t) => n + t.bytes, 0);
  const m = stats.migrations;
  const tiles: StatTileProps[] = [
    {
      label: 'Tabel',
      value: nf.format(schema.tables.length),
      hint: `${nf.format(columns)} kolom`,
      icon: FiDatabase,
    },
    {
      label: 'Relasi',
      value: nf.format(schema.edges.length),
      hint: 'foreign key',
      icon: FiGitMerge,
      color: 'indigo',
    },
    {
      label: 'Index',
      value: nf.format(indexes),
      hint: 'di luar primary key',
      icon: FiList,
      color: 'cyan',
    },
    {
      label: 'Total baris',
      value: nf.format(rows),
      hint: 'semua tabel, hitung nyata',
      icon: FiColumns,
      color: 'teal',
    },
    {
      label: 'Ukuran di disk',
      value: fmtBytes(bytes),
      hint: 'termasuk index dan TOAST',
      icon: FiHardDrive,
      color: 'grape',
    },
    {
      label: 'Migrasi',
      value: `${m.applied}/${m.journal}`,
      hint: m.pending > 0 ? `${m.pending} belum diterapkan` : `terbaru ${m.latestTag ?? '—'}`,
      icon: FiLayers,
      color: m.pending > 0 ? 'red' : 'teal',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}

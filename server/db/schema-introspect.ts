import { getTableName, is, SQL } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type ColumnMeta = {
  key: string;
  dbName: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  /** 'literal' (constant), 'sql' (e.g. now()), 'fn' (JS $defaultFn), or null. */
  defaultKind: 'literal' | 'sql' | 'fn' | null;
  /** Human-readable default when known ("false", "now()", "'singleton'"). */
  defaultText: string | null;
  fkTable?: string;
  fkColumn?: string;
  onDelete?: string;
};

export type IndexMeta = { name: string; columns: string[]; unique: boolean };

export type TableMeta = {
  id: string;
  name: string;
  columns: ColumnMeta[];
  indexes: IndexMeta[];
};

export type FkEdge = {
  id: string;
  source: string;
  sourceColumn: string;
  target: string;
  targetColumn: string;
  onDelete: string;
};

export type SchemaGraph = { tables: TableMeta[]; edges: FkEdge[] };

const PG_TYPE_MAP: Record<string, string> = {
  PgText: 'text',
  PgVarchar: 'varchar',
  PgBoolean: 'boolean',
  PgTimestamp: 'timestamp',
  PgInteger: 'integer',
  PgSerial: 'serial',
  PgBigInt: 'bigint',
  PgNumeric: 'numeric',
  PgJsonb: 'jsonb',
  PgJson: 'json',
  PgUUID: 'uuid',
  PgDate: 'date',
};

type ColumnInternals = {
  hasDefault?: boolean;
  defaultFn?: unknown;
  default?: unknown;
  isUnique?: boolean;
};

/** Best-effort text for a column default (drizzle keeps SQL defaults as chunk lists). */
export function describeDefault(
  col: ColumnInternals,
): Pick<ColumnMeta, 'defaultKind' | 'defaultText'> {
  if (typeof col.defaultFn === 'function')
    return { defaultKind: 'fn', defaultText: 'app-generated' };
  if (!col.hasDefault) return { defaultKind: null, defaultText: null };
  const d = col.default;
  if (is(d, SQL)) {
    const text = (d as unknown as { queryChunks?: Array<{ value?: string[] }> }).queryChunks
      ?.map((c) => (Array.isArray(c.value) ? c.value.join('') : ''))
      .join('')
      .trim();
    return { defaultKind: 'sql', defaultText: text || 'sql' };
  }
  if (d === undefined) return { defaultKind: 'sql', defaultText: null };
  return { defaultKind: 'literal', defaultText: typeof d === 'string' ? `'${d}'` : String(d) };
}

export function introspectDrizzleSchema(): SchemaGraph {
  const tables: TableMeta[] = [];
  const edges: FkEdge[] = [];

  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    const tableName = config.name;
    const pkCols = new Set<string>(
      config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)),
    );

    const fkColMap = new Map<string, { fkTable: string; fkColumn: string; onDelete: string }>();
    for (const fk of config.foreignKeys) {
      const ref = fk.reference();
      if (!ref.columns.length || !ref.foreignColumns.length) continue;
      const fromCol = ref.columns[0];
      const toCol = ref.foreignColumns[0];
      // biome-ignore lint/suspicious/noExplicitAny: drizzle internal — table ref not in public types
      const toTableName = getTableName((toCol as any).table);
      const onDelete = fk.onDelete ?? 'no action';
      fkColMap.set(fromCol.name, { fkTable: toTableName, fkColumn: toCol.name, onDelete });
      edges.push({
        id: `${tableName}.${fromCol.name}→${toTableName}.${toCol.name}`,
        source: tableName,
        sourceColumn: fromCol.name,
        target: toTableName,
        targetColumn: toCol.name,
        onDelete,
      });
    }

    const columns: ColumnMeta[] = config.columns.map((col) => {
      const internals = col as unknown as ColumnInternals;
      return {
        key: col.name,
        dbName: col.name,
        type: PG_TYPE_MAP[col.columnType as string] ?? col.dataType ?? 'unknown',
        pk: col.primary || pkCols.has(col.name),
        notNull: col.notNull,
        unique: Boolean(internals.isUnique),
        ...describeDefault(internals),
        ...fkColMap.get(col.name),
      };
    });

    const indexes: IndexMeta[] = config.indexes.map((ix) => ({
      name: ix.config.name ?? '',
      columns: ix.config.columns.map((c) => ('name' in c ? String(c.name) : String(c))),
      unique: Boolean(ix.config.unique),
    }));

    tables.push({ id: tableName, name: tableName, columns, indexes });
  }

  return { tables, edges };
}

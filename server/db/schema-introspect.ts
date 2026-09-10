import { getTableName, is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type ColumnMeta = {
  key: string;
  dbName: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  fkTable?: string;
  fkColumn?: string;
};

export type TableMeta = {
  id: string;
  name: string;
  columns: ColumnMeta[];
};

export type FkEdge = {
  id: string;
  source: string;
  sourceColumn: string;
  target: string;
  targetColumn: string;
};

export type SchemaGraph = {
  tables: TableMeta[];
  edges: FkEdge[];
};

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

    const fkColMap = new Map<string, { fkTable: string; fkColumn: string }>();
    for (const fk of config.foreignKeys) {
      const ref = fk.reference();
      if (!ref.columns.length || !ref.foreignColumns.length) continue;
      const fromCol = ref.columns[0];
      const toCol = ref.foreignColumns[0];
      // biome-ignore lint/suspicious/noExplicitAny: drizzle internal — table ref not in public types
      const toTableName = getTableName((toCol as any).table);
      fkColMap.set(fromCol.name, { fkTable: toTableName, fkColumn: toCol.name });
      edges.push({
        id: `${tableName}.${fromCol.name}→${toTableName}.${toCol.name}`,
        source: tableName,
        sourceColumn: fromCol.name,
        target: toTableName,
        targetColumn: toCol.name,
      });
    }

    const columns: ColumnMeta[] = config.columns.map((col) => ({
      key: col.name,
      dbName: col.name,
      type: PG_TYPE_MAP[col.columnType as string] ?? col.dataType ?? 'unknown',
      pk: col.primary || pkCols.has(col.name),
      notNull: col.notNull,
      ...fkColMap.get(col.name),
    }));

    tables.push({ id: tableName, name: tableName, columns });
  }

  return { tables, edges };
}

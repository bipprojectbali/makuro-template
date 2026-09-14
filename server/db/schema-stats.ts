/**
 * Live database facts for the schema console: row counts and on-disk size per
 * table, plus migration status (journal vs. applied). Static shape comes from
 * schema-introspect.ts; this file only adds what needs a DB round-trip.
 */
import { sql } from 'drizzle-orm';
import { db } from './index';
import journal from './migrations/meta/_journal.json' with { type: 'json' };

export type TableStats = { table: string; rows: number; bytes: number };
export type MigrationStatus = {
  journal: number;
  applied: number;
  pending: number;
  latestTag: string | null;
  lastAppliedAt: string | null;
};
export type SchemaStats = {
  tables: TableStats[];
  migrations: MigrationStatus;
  generatedAt: string;
};

async function tableStats(table: string): Promise<TableStats> {
  const ident = sql.identifier(table);
  const [row] = await db.execute<{ rows: number; bytes: number }>(
    sql`select (select count(*)::int from ${ident}) as rows, pg_total_relation_size(${sql.raw(`'"${table}"'`)}::regclass)::bigint as bytes`,
  );
  return { table, rows: Number(row?.rows ?? 0), bytes: Number(row?.bytes ?? 0) };
}

/** Journal entries vs rows in drizzle.__drizzle_migrations (also feeds the sidebar badge). */
export async function migrationStatus(): Promise<MigrationStatus> {
  const entries = journal.entries as Array<{ tag: string }>;
  const latestTag = entries.at(-1)?.tag ?? null;
  try {
    const [row] = await db.execute<{ applied: number; last: string | null }>(
      sql`select count(*)::int as applied, max(created_at)::bigint as last from drizzle.__drizzle_migrations`,
    );
    const applied = Number(row?.applied ?? 0);
    return {
      journal: entries.length,
      applied,
      pending: Math.max(0, entries.length - applied),
      latestTag,
      lastAppliedAt: row?.last ? new Date(Number(row.last)).toISOString() : null,
    };
  } catch {
    // Migrations table absent (fresh DB or push-only workflow) — everything counts as pending.
    return {
      journal: entries.length,
      applied: 0,
      pending: entries.length,
      latestTag,
      lastAppliedAt: null,
    };
  }
}

/** Row/size stats for the given tables (from introspection) + migration status. */
export async function schemaStats(tableNames: string[]): Promise<SchemaStats> {
  const [tables, migrations] = await Promise.all([
    Promise.all(tableNames.map(tableStats)),
    migrationStatus(),
  ]);
  return { tables, migrations, generatedAt: new Date().toISOString() };
}

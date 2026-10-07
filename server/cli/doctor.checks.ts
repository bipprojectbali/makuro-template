/** Health checks behind `doctor`: environment, .env, database, storage and host — each failure becomes a Check, never a throw. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type postgres from 'postgres';
import { z } from 'zod';
import journal from '../db/migrations/meta/_journal.json' with { type: 'json' };
import { pgClient } from '../local-pg/client';
import {
  currentPlatform,
  dataDir,
  isLocalMode,
  localDatabaseUrl,
  runtimeDir,
} from '../local-pg/paths';
import { installedIntegrity, PG_ARCHIVES, runtimeInstalled } from '../local-pg/runtime';
import { PKG_NAME, PKG_VERSION } from '../pkg';
import { hostChecks } from './doctor.host';
import { storageChecks } from './doctor.storage';

export type CheckStatus = 'ok' | 'warn' | 'fail';
export type Check = {
  group: 'Lingkungan' | '.env' | 'Database' | 'Storage' | 'Host';
  name: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
};
export type DoctorContext = {
  env: Record<string, string | undefined>;
  cwd: string;
  skipNetwork?: boolean;
};

export const MIN_SECRET_LENGTH = 32;
const DB_CONNECT_TIMEOUT_S = 3;

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));
const initHint = `jalankan \`${PKG_NAME} init\``;

function environmentChecks(local: boolean): Check[] {
  const g = 'Lingkungan' as const;
  const platform = currentPlatform();
  const isRoot = process.getuid?.() === 0;
  return [
    {
      group: g,
      name: 'Versi',
      status: 'ok',
      detail: `${PKG_NAME} ${PKG_VERSION} (bun ${Bun.version})`,
    },
    platform
      ? { group: g, name: 'Platform', status: 'ok', detail: platform }
      : {
          group: g,
          name: 'Platform',
          status: local ? 'fail' : 'warn',
          detail: `${process.platform}-${process.arch} tidak didukung Postgres lokal`,
          hint: 'set DATABASE_URL ke Postgres eksternal',
        },
    isRoot
      ? {
          group: g,
          name: 'User',
          status: local ? 'fail' : 'warn',
          detail: 'berjalan sebagai root',
          hint: 'jalankan sebagai user biasa (Postgres menolak root)',
        }
      : { group: g, name: 'User', status: 'ok', detail: 'bukan root' },
  ];
}

const urlField = z.string().url();

function envChecks(ctx: DoctorContext): Check[] {
  const g = '.env' as const;
  const { env } = ctx;
  const checks: Check[] = [
    existsSync(path.join(ctx.cwd, '.env'))
      ? { group: g, name: 'File .env', status: 'ok', detail: 'ada' }
      : {
          group: g,
          name: 'File .env',
          status: 'warn',
          detail: 'tidak ada di direktori kerja',
          hint: initHint,
        },
  ];
  const secret = env.BETTER_AUTH_SECRET ?? '';
  if (!secret || secret.startsWith('change-me')) {
    checks.push({
      group: g,
      name: 'BETTER_AUTH_SECRET',
      status: 'fail',
      detail: secret ? `masih nilai contoh (len ${secret.length})` : 'tidak di-set',
      hint: initHint,
    });
  } else {
    const short = secret.length < MIN_SECRET_LENGTH;
    checks.push({
      group: g,
      name: 'BETTER_AUTH_SECRET',
      status: short ? 'warn' : 'ok',
      detail: `set (len ${secret.length})`,
      hint: short ? `gunakan minimal ${MIN_SECRET_LENGTH} karakter acak` : undefined,
    });
  }
  const port = env.PORT;
  checks.push(
    port === undefined || z.coerce.number().int().positive().safeParse(port).success
      ? { group: g, name: 'PORT', status: 'ok', detail: port ?? 'default' }
      : { group: g, name: 'PORT', status: 'fail', detail: `bukan angka: "${port}"` },
  );
  for (const key of ['APP_URL', 'BETTER_AUTH_URL'] as const) {
    const v = env[key];
    checks.push(
      v === undefined || urlField.safeParse(v).success
        ? { group: g, name: key, status: 'ok', detail: v ?? 'default' }
        : { group: g, name: key, status: 'fail', detail: 'bukan URL yang valid' },
    );
  }
  if (Bun.isStandaloneExecutable && env.NODE_ENV && env.NODE_ENV !== 'production') {
    checks.push({
      group: g,
      name: 'NODE_ENV',
      status: 'warn',
      detail: `${env.NODE_ENV} (binary seharusnya production)`,
    });
  }
  return checks;
}

async function migrationCheck(sql: postgres.Sql): Promise<Check> {
  const total = journal.entries.length;
  try {
    const [row] = await sql<
      { n: number }[]
    >`select count(*)::int as n from drizzle.__drizzle_migrations`;
    const pending = Math.max(0, total - Number(row?.n ?? 0));
    return pending
      ? {
          group: 'Database',
          name: 'Migrasi',
          status: 'warn',
          detail: `${pending}/${total} pending`,
        }
      : { group: 'Database', name: 'Migrasi', status: 'ok', detail: `${total} diterapkan` };
  } catch (err) {
    return {
      group: 'Database',
      name: 'Migrasi',
      status: 'warn',
      detail: `${total}/${total} pending (${errMsg(err)})`,
      hint: 'migrasi dijalankan otomatis saat start',
    };
  }
}

async function connectivityChecks(url: string, local: boolean): Promise<Check[]> {
  const sql = pgClient(url, { max: 1, connect_timeout: DB_CONNECT_TIMEOUT_S, onnotice: () => {} });
  try {
    await sql`select 1`;
    return [
      { group: 'Database', name: 'Koneksi', status: 'ok', detail: 'terhubung' },
      await migrationCheck(sql),
    ];
  } catch (err) {
    return [
      local
        ? {
            group: 'Database',
            name: 'Koneksi',
            status: 'warn',
            detail: 'server tidak sedang berjalan',
          }
        : {
            group: 'Database',
            name: 'Koneksi',
            status: 'fail',
            detail: errMsg(err),
            hint: 'periksa DATABASE_URL',
          },
    ];
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function databaseChecks(ctx: DoctorContext, local: boolean): Promise<Check[]> {
  const g = 'Database' as const;
  const checks: Check[] = [
    {
      group: g,
      name: 'Mode',
      status: 'ok',
      detail: local ? 'Postgres lokal' : 'DATABASE_URL eksternal',
    },
  ];
  const platform = currentPlatform();
  if (local && platform) {
    const dir = runtimeDir(platform);
    if (!(await runtimeInstalled(dir))) {
      checks.push({
        group: g,
        name: 'Runtime PG',
        status: 'fail',
        detail: `belum terpasang di ${dir}`,
        hint: initHint,
      });
    } else {
      const ok = (await installedIntegrity(dir)) === PG_ARCHIVES[platform].integrity;
      checks.push(
        ok
          ? { group: g, name: 'Runtime PG', status: 'ok', detail: dir }
          : {
              group: g,
              name: 'Runtime PG',
              status: 'fail',
              detail: 'hash tidak cocok dengan versi ter-pin',
              hint: initHint,
            },
      );
    }
    const data = dataDir();
    checks.push(
      existsSync(path.join(data, 'PG_VERSION'))
        ? { group: g, name: 'Data dir', status: 'ok', detail: data }
        : {
            group: g,
            name: 'Data dir',
            status: 'warn',
            detail: `belum di-initdb: ${data}`,
            hint: initHint,
          },
    );
  }
  if (!ctx.skipNetwork && (!local || platform)) {
    checks.push(
      ...(await connectivityChecks(
        local ? localDatabaseUrl() : (ctx.env.DATABASE_URL as string),
        local,
      )),
    );
  }
  return checks;
}

/** Run every check against the given env/cwd (paths of the local runtime/data/backups still come from process.env). */
export async function collectChecks(ctx: DoctorContext): Promise<Check[]> {
  const local = isLocalMode(ctx.env);
  return [
    ...environmentChecks(local),
    ...envChecks(ctx),
    ...(await databaseChecks(ctx, local)),
    ...(await storageChecks(ctx)),
    ...(await hostChecks(ctx, local)),
  ];
}

/** Storage checks for `doctor`: mode, RustFS runtime + data dir (local) or S3_* presence (external). Optional → warn, never fail. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  currentS3Platform,
  isLocalStorageMode,
  s3Dir,
  s3RuntimeDir,
  unsupportedMessage,
} from '../local-s3/paths';
import { s3RuntimeInstalled } from '../local-s3/runtime';
import { PKG_NAME } from '../pkg';
import type { Check, DoctorContext } from './doctor.checks';

const REQUIRED = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;
const initHint = `jalankan \`${PKG_NAME} init\``;

export async function storageChecks(ctx: DoctorContext): Promise<Check[]> {
  const g = 'Storage' as const;
  if (!isLocalStorageMode(ctx.env)) {
    const missing = REQUIRED.filter((k) => !ctx.env[k]);
    return [
      { group: g, name: 'Mode', status: 'ok', detail: 'S3 eksternal (S3_ENDPOINT)' },
      missing.length
        ? {
            group: g,
            name: 'Konfigurasi',
            status: 'warn',
            detail: `belum di-set: ${missing.join(', ')}`,
          }
        : { group: g, name: 'Konfigurasi', status: 'ok', detail: 'S3_* lengkap' },
    ];
  }
  const checks: Check[] = [{ group: g, name: 'Mode', status: 'ok', detail: 'RustFS lokal' }];
  const platform = currentS3Platform();
  if (!platform) {
    checks.push({ group: g, name: 'Runtime S3', status: 'warn', detail: unsupportedMessage() });
    return checks;
  }
  const dir = s3RuntimeDir(platform);
  checks.push(
    (await s3RuntimeInstalled(dir))
      ? { group: g, name: 'Runtime S3', status: 'ok', detail: dir }
      : {
          group: g,
          name: 'Runtime S3',
          status: 'warn',
          detail: `belum terpasang di ${dir}`,
          hint: initHint,
        },
  );
  const data = s3Dir();
  checks.push(
    existsSync(path.join(data, 'keys.json'))
      ? { group: g, name: 'Data dir', status: 'ok', detail: data }
      : {
          group: g,
          name: 'Data dir',
          status: 'warn',
          detail: `belum diinisialisasi: ${data}`,
          hint: initHint,
        },
  );
  return checks;
}

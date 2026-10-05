/** `version`: build identity without touching `.env` or the database. */
import { parseArgs } from 'node:util';
import { PG_VERSION } from '../local-pg/paths';
import { runtimeInstalled } from '../local-pg/runtime';
import { PKG_NAME, PKG_VERSION } from '../pkg';

export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { json: { type: 'boolean' } } });
  const info = {
    name: PKG_NAME,
    version: PKG_VERSION,
    bun: Bun.version,
    platform: `${process.platform}-${process.arch}`,
    standalone: Bun.isStandaloneExecutable,
    postgres: { version: PG_VERSION, installed: await runtimeInstalled() },
  };
  if (values.json) {
    console.log(JSON.stringify(info));
    return 0;
  }
  console.log(`${info.name} ${info.version}`);
  console.log(`bun ${info.bun}`);
  console.log(info.platform);
  console.log(
    `postgres lokal ${PG_VERSION} (${info.postgres.installed ? 'terpasang' : 'belum terpasang'})`,
  );
  return 0;
}

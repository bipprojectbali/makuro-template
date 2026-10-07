/** `start`: boot local Postgres when in local mode (plus migrations) and local RustFS, then the production server. */
import { bootLocalPg } from '../local-pg/boot';
import { bootLocalStorage } from '../local-s3/boot';

export async function run(_argv: string[]): Promise<number> {
  try {
    await bootLocalPg();
  } catch (err) {
    // Expected failures (runtime missing, running as root) carry an actionable message; no stack.
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  // Fail-soft: storage stays unconfigured (warned) but the app still serves.
  await bootLocalStorage();
  await import('../prod');
  return 0;
}

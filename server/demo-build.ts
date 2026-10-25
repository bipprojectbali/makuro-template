/**
 * Demo-build marker. `build:binary:demo` compiles with
 * `--define process.env.MAKURO_DEMO_BUILD="1"`, which inlines the value into the
 * Bun-side copy of this module only. Promoting it to `process.env.MAKURO_DEMO`
 * makes the Vite-bundled copy of the server modules (build/server/index.js) read
 * the same value — one process, one `process.env`. Set-only: the Vite copy also
 * runs this line with the flag undefined and must not undo the Bun copy's write.
 *
 * Runs after Bun auto-loads `.env`, so `MAKURO_DEMO=0` cannot turn a demo binary
 * off. Setting `MAKURO_DEMO=1` by hand enables demo mode in script mode too.
 *
 * No imports on purpose: this module is on the CLI path, which runs before `.env`
 * is valid (so it must not pull in `server/env.ts` or `server/db`).
 */
if (process.env.MAKURO_DEMO_BUILD === '1') process.env.MAKURO_DEMO = '1';

/** True when demo mode is forced on by the build (or by `MAKURO_DEMO=1`). */
export function isDemoBuild(): boolean {
  return process.env.MAKURO_DEMO === '1';
}

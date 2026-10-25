/**
 * Demo-build marker. `build:binary:demo` compiles with
 * `--define process.env.MAKURO_DEMO_BUILD="1"`, which folds the value into a
 * constant in every bundled copy of the server modules — `build/server/index.js`
 * enters the compile as a static-import input, so the Vite-bundled copy gets it
 * too. Promoting it to `process.env.MAKURO_DEMO` is what makes `MAKURO_DEMO=1`
 * work in script mode (`bun run dev`), where nothing is compiled and no
 * `--define` applies, under one public env-var name.
 *
 * Two names on purpose: `--define` substitutes textually, assignment left-hand
 * sides included, so writing to the same name it replaces would compile to
 * `"1" = '1'` — a syntax error. `MAKURO_DEMO_BUILD` is read-only, `MAKURO_DEMO`
 * is the runtime channel.
 *
 * Runs after Bun auto-loads `.env`, so `MAKURO_DEMO=0` cannot turn a demo binary
 * off.
 *
 * No imports on purpose: this module is on the CLI path, which runs before `.env`
 * is valid (so it must not pull in `server/env.ts` or `server/db`).
 */
if (process.env.MAKURO_DEMO_BUILD === '1') process.env.MAKURO_DEMO = '1';

/** True when demo mode is forced on by the build (or by `MAKURO_DEMO=1`). */
export function isDemoBuild(): boolean {
  return process.env.MAKURO_DEMO === '1';
}

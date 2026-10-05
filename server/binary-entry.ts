/**
 * CLI entrypoint (binary and `bun run cli`). Defaults NODE_ENV to production
 * before any module initializes so pino picks its sync multistream and the
 * API hides internal error details. An explicit NODE_ENV — from the real
 * environment or a `.env` in the working directory, which Bun auto-loads — is
 * respected but flagged, because a production binary running as
 * "development" exposes error details and skips file logging.
 */
import { main, resolveCommand } from './cli';

process.env.NODE_ENV ??= 'production';
const argv = process.argv.slice(2);
const isStart = resolveCommand(argv)?.name === 'start';
if (isStart && process.env.NODE_ENV !== 'production') {
  console.warn(
    `[makuro] NODE_ENV=${process.env.NODE_ENV} — binary berjalan bukan dalam mode production (cek .env di direktori kerja).`,
  );
}
const code = await main(argv);
// `start` keeps the process alive via the HTTP server; every other command exits explicitly.
if (!isStart || code !== 0) process.exit(code);

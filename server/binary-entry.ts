/**
 * Binary entrypoint (bun build --compile). Defaults NODE_ENV to production
 * before any module initializes so pino picks its sync multistream and the
 * API hides internal error details. An explicit NODE_ENV — from the real
 * environment or a `.env` in the working directory, which Bun auto-loads — is
 * respected but flagged, because a production binary running as
 * "development" exposes error details and skips file logging.
 */
process.env.NODE_ENV ??= 'production';
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    `[makuro] NODE_ENV=${process.env.NODE_ENV} — binary berjalan bukan dalam mode production (cek .env di direktori kerja).`,
  );
}
await import('./prod');

export {};

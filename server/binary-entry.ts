// Binary entrypoint: set NODE_ENV=production before any module initializes.
// This ensures pino uses its sync multistream (no worker threads) even when
// the user runs the binary without setting NODE_ENV explicitly.
process.env.NODE_ENV ??= 'production';
await import('./prod.ts');

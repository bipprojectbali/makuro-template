import pino from 'pino';
import { env, isProd } from './env';

// Bun.isStandaloneExecutable is true when running inside a compiled binary (bun build --compile).
// In binary mode we avoid pino-pretty's worker threads and file-based logging.
const isStandalone = Bun.isStandaloneExecutable;

async function createLogger() {
  if (isStandalone) {
    // Binary mode: stdout-only JSON logging — no worker threads, no FS writes.
    // Log rotation at the process-manager / container layer (systemd, Docker, etc.).
    return pino({ level: 'info', base: { env: env.NODE_ENV } });
  }
  if (isProd) {
    // Regular prod (bun run start): stdout + daily-rotating log file via pino-roll.
    // pino-roll's build() creates a SonicBoom stream (no worker threads).
    const build = (await import('pino-roll')).default;
    const rollStream = await build('logs/app.log', {
      frequency: '1d',
      size: '10m',
      limit: { count: 7 },
    });
    return pino(
      { level: 'info', base: { env: env.NODE_ENV } },
      pino.multistream([
        { stream: process.stdout, level: 'info' as const },
        { stream: rollStream, level: 'warn' as const },
      ]),
    );
  }
  return pino({
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
    base: { env: env.NODE_ENV },
  });
}

export const logger = await createLogger();

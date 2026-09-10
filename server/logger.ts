import pino from 'pino';
import { env, isProd } from './env';

async function createLogger() {
  if (isProd) {
    // In production, write to both stdout and a daily-rotating log file.
    // pino-roll's build() creates a SonicBoom stream (no worker threads) so
    // it works in Bun without the bun-plugin-pino workaround.
    const build = (await import('pino-roll')).default;
    const rollStream = await build('logs/app.log', {
      frequency: '1d',
      size: '10m',
      // Keep 7 rotated files (one week of daily logs).
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

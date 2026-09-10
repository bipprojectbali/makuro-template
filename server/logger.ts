import pino from 'pino';
import { logBuffer } from './mcp/log-buffer';
import { env, isProd } from './env';

const bufferStream = logBuffer.asWritable();

// Primary stream: pino-pretty in dev (via worker thread), stdout in prod.
const primaryStream = isProd
  ? process.stdout
  : pino.transport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    });

export const logger = pino(
  { level: isProd ? 'info' : 'debug', base: { env: env.NODE_ENV } },
  pino.multistream([
    { stream: primaryStream, level: isProd ? 'info' : 'debug' },
    // Buffer captures warn+ (error/warn only) for MCP log tools.
    { stream: bufferStream, level: 'warn' },
  ]),
);

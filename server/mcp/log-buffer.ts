import { Writable } from 'node:stream';

export type LogEntry = {
  level: number;
  time: number;
  msg: string;
  [key: string]: unknown;
};

export const LEVEL_NAMES: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

export class LogBuffer {
  private entries: LogEntry[] = [];

  constructor(private readonly maxSize: number) {}

  push(entry: LogEntry) {
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) this.entries.shift();
  }

  query(opts: { limit?: number; level?: string; search?: string; since?: number }): LogEntry[] {
    const minLevel = Object.entries(LEVEL_NAMES).find(([, v]) => v === opts.level)?.[0];
    const result = this.entries.filter((e) => {
      if (minLevel && e.level < Number(minLevel)) return false;
      if (opts.since && e.time < opts.since) return false;
      if (opts.search && !JSON.stringify(e).toLowerCase().includes(opts.search.toLowerCase()))
        return false;
      return true;
    });
    const limit = opts.limit ?? 50;
    return result.slice(-limit);
  }

  size() {
    return this.entries.length;
  }

  /** Returns a Node Writable that accepts raw Pino JSON lines and pushes them into the buffer. */
  asWritable(): Writable {
    const buf = this;
    return new Writable({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        try {
          const line = chunk.toString().trim();
          if (line) buf.push(JSON.parse(line) as LogEntry);
        } catch {}
        cb();
      },
    });
  }
}

/** Singleton ring buffer — shared between logger.ts and MCP log tools. */
export const logBuffer = new LogBuffer(500);

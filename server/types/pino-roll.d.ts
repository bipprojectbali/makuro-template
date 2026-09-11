declare module 'pino-roll' {
  import type { Writable } from 'node:stream';

  interface PinoRollOptions {
    frequency?: 'daily' | 'hourly' | '1d' | '1h' | string;
    size?: string;
    limit?: { count: number };
    dateFormat?: string;
    extension?: string;
  }

  function build(file: string, options?: PinoRollOptions): Promise<Writable>;
  export default build;
}

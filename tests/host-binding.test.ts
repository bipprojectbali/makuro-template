/**
 * Contract for HOST: both entrypoints must hand it to their listener, otherwise
 * the variable is decorative and the server keeps binding every interface —
 * exactly the bug this guards against. Also pins the boot banner's URL, since
 * 0.0.0.0 is not reachable as one.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { env, listenUrl } from '../server/env';

const read = (file: string) => readFileSync(path.join(import.meta.dir, '../server', file), 'utf8');

describe('HOST', () => {
  test('env exposes a non-empty host', () => {
    expect(env.HOST.length).toBeGreaterThan(0);
  });

  test('prod.ts passes it to Bun.serve', () => {
    expect(read('prod.ts')).toContain('hostname: env.HOST');
  });

  test('dev.ts passes it to server.listen', () => {
    expect(read('dev.ts')).toContain('server.listen(env.PORT, env.HOST');
  });

  test('.env.example documents it', () => {
    const example = readFileSync(path.join(import.meta.dir, '../.env.example'), 'utf8');
    expect(example).toMatch(/^HOST=/m);
  });

  test('listenUrl is reachable: never 0.0.0.0, always the bound port', () => {
    expect(listenUrl).not.toContain('0.0.0.0');
    expect(listenUrl.endsWith(`:${env.PORT}`)).toBe(true);
  });
});

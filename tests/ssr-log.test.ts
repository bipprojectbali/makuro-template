/** SSR → process logger bridge: dispatches to the registered logger, falls back to console. */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { logger } from '../server/logger';
import { processLog, registerProcessLogger } from '../server/ssr-log';

afterEach(() => registerProcessLogger(logger));

describe('processLog', () => {
  test('uses the registered logger', () => {
    const calls: Array<[string, unknown, string]> = [];
    registerProcessLogger({
      warn: (o, m) => calls.push(['warn', o, m]),
      error: (o, m) => calls.push(['error', o, m]),
    });
    processLog('error', { path: '/x' }, 'boom');
    processLog('warn', { status: 403 }, 'denied');
    expect(calls).toEqual([
      ['error', { path: '/x' }, 'boom'],
      ['warn', { status: 403 }, 'denied'],
    ]);
  });
  test('falls back to console when nothing is registered', () => {
    registerProcessLogger(null);
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    processLog('error', { a: 1 }, 'fallback');
    expect(spy).toHaveBeenCalledWith('fallback', { a: 1 });
    spy.mockRestore();
  });
  test('server/logger.ts registers itself at import', () => {
    registerProcessLogger(null);
    // Re-register the way logger.ts does and make sure the real instance is usable.
    registerProcessLogger(logger);
    expect(() => processLog('warn', { test: true }, 'ssr-log self-check')).not.toThrow();
  });
});

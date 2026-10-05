/** CLI dispatch: default subcommand, aliases, unknown commands, usage text. */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import pkg from '../../package.json' with { type: 'json' };
import { COMMANDS, main, resolveCommand, usage } from '../../server/cli';

afterEach(() => {
  for (const m of ['log', 'error'] as const)
    (console[m] as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('resolveCommand', () => {
  test('no arguments selects start', () => {
    expect(resolveCommand([])).toEqual({ name: 'start', args: [] });
  });
  test('subcommand arguments are passed through', () => {
    expect(resolveCommand(['init', '--yes', '--db=local'])).toEqual({
      name: 'init',
      args: ['--yes', '--db=local'],
    });
  });
  test('--version / -v alias version, --help / -h alias help', () => {
    expect(resolveCommand(['--version'])?.name).toBe('version');
    expect(resolveCommand(['-v'])?.name).toBe('version');
    expect(resolveCommand(['--help'])?.name).toBe('help');
    expect(resolveCommand(['-h'])?.name).toBe('help');
  });
  test('unknown command or bare flag resolves to null', () => {
    expect(resolveCommand(['deploy'])).toBeNull();
    expect(resolveCommand(['--port'])).toBeNull();
  });
});

describe('main', () => {
  test('unknown command exits 2 and prints usage to stderr', async () => {
    const err = spyOn(console, 'error').mockImplementation(() => {});
    expect(await main(['nope'])).toBe(2);
    expect(err.mock.calls.flat().join('\n')).toContain('Perintah tidak dikenal: nope');
  });
  test('help exits 0 and lists every command under the package name', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['help'])).toBe(0);
    const out = log.mock.calls.flat().join('\n');
    expect(out).toContain(`Pemakaian: ${pkg.name}`);
    for (const name of Object.keys(COMMANDS)) expect(out).toContain(name);
  });
  test('command map covers the agreed subcommands', () => {
    expect(Object.keys(COMMANDS).sort()).toEqual([
      'backup',
      'doctor',
      'init',
      'start',
      'upgrade',
      'version',
    ]);
    expect(usage()).toContain('start');
  });
});

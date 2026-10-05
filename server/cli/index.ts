/** CLI dispatcher: first argument picks the subcommand (default `start`); modules load lazily so `version`/`doctor` never validate `.env`. */
import { PKG_NAME } from '../pkg';

type Command = { summary: string; load: () => Promise<{ run(argv: string[]): Promise<number> }> };

export const COMMANDS: Record<string, Command> = {
  start: { summary: 'Jalankan server (default bila tanpa argumen)', load: () => import('./start') },
  init: { summary: 'Siapkan .env, Postgres lokal, dan migrasi', load: () => import('./init') },
  doctor: { summary: 'Periksa kesiapan lingkungan & database', load: () => import('./doctor') },
  backup: { summary: 'Cadangkan data Postgres lokal', load: () => import('./backup') },
  upgrade: { summary: 'Perbarui binary ke rilis terbaru', load: () => import('./upgrade') },
  version: { summary: 'Tampilkan versi', load: () => import('./version') },
};

export function usage(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  const lines = Object.entries(COMMANDS).map(
    ([name, c]) => `  ${name.padEnd(width)}  ${c.summary}`,
  );
  return [
    `Pemakaian: ${PKG_NAME} [perintah] [opsi]`,
    '',
    'Perintah:',
    ...lines,
    '',
    `Bantuan: ${PKG_NAME} help`,
  ].join('\n');
}

/** Resolve argv to a subcommand name + its arguments; null = unknown command. */
export function resolveCommand(argv: string[]): { name: string; args: string[] } | null {
  const [first, ...rest] = argv;
  if (first === undefined) return { name: 'start', args: [] };
  if (first === '--version' || first === '-v') return { name: 'version', args: rest };
  if (first === 'help' || first === '--help' || first === '-h') return { name: 'help', args: rest };
  return first in COMMANDS ? { name: first, args: rest } : null;
}

/** Run the CLI; returns the exit code. `start` resolves once the server is listening and must not be followed by process.exit. */
export async function main(argv: string[]): Promise<number> {
  const cmd = resolveCommand(argv);
  if (!cmd) {
    console.error(`Perintah tidak dikenal: ${argv[0]}\n`);
    console.error(usage());
    return 2;
  }
  if (cmd.name === 'help') {
    console.log(usage());
    return 0;
  }
  const mod = await COMMANDS[cmd.name].load();
  return mod.run(cmd.args);
}

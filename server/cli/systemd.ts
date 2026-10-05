/** systemd unit for running the binary as a non-root service (`init --systemd`). */
import os from 'node:os';
import path from 'node:path';
import { PKG_NAME } from '../pkg';

export type UnitOptions = { execPath: string; cwd: string; user: string };

/** `%` is a systemd specifier prefix everywhere in unit files. */
const escapeSpecifiers = (s: string) => s.replaceAll('%', '%%');

/** Quote one ExecStart word per systemd command-line rules. */
export function quoteExecArg(arg: string): string {
  const s = escapeSpecifiers(arg);
  return /[\s"'\\;]/.test(s) ? `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"` : s;
}

/** Render the unit file text (pure). */
export function renderSystemdUnit({ execPath, cwd, user }: UnitOptions): string {
  return `[Unit]
Description=${PKG_NAME}
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${escapeSpecifiers(cwd)}
ExecStart=${quoteExecArg(execPath)} start
Restart=on-failure
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=30
Environment=NODE_ENV=production
# Light hardening: /usr,/boot,/etc read-only; home stays writable (Postgres runtime lives in ~/.cache).
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`;
}

/** Write `<cwd>/<name>.service` for the invoking (non-root) user; returns its path. */
export async function writeSystemdUnit(opts: {
  execPath: string;
  cwd: string;
  user?: string;
}): Promise<string> {
  if (!opts.user && process.getuid?.() === 0) {
    throw new Error(
      'Jalankan init sebagai user biasa (bukan root): Postgres lokal menolak berjalan sebagai root.',
    );
  }
  const user = opts.user ?? os.userInfo().username;
  if (user === 'root') {
    throw new Error('User service tidak boleh root: Postgres lokal menolak berjalan sebagai root.');
  }
  const file = path.join(opts.cwd, `${PKG_NAME}.service`);
  await Bun.write(file, renderSystemdUnit({ execPath: opts.execPath, cwd: opts.cwd, user }));
  return file;
}

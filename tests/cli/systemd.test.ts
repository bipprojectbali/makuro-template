/** `init --systemd` unit: non-root user, start command, no ProtectHome, systemd quoting. */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { quoteExecArg, renderSystemdUnit, writeSystemdUnit } from '../../server/cli/systemd';
import { PKG_NAME } from '../../server/pkg';

let dir: string | undefined;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('systemd unit', () => {
  test('renders user, working dir, start command and light hardening', () => {
    const unit = renderSystemdUnit({ execPath: '/opt/app/bin', cwd: '/srv/app', user: 'deploy' });
    expect(unit).toContain('User=deploy');
    expect(unit).toContain('WorkingDirectory=/srv/app');
    expect(unit).toContain('ExecStart=/opt/app/bin start');
    expect(unit).toContain('Environment=NODE_ENV=production');
    expect(unit).toContain('ProtectSystem=full');
    expect(unit).not.toContain('ProtectHome');
    expect(unit).toContain('WantedBy=multi-user.target');
  });

  test('quotes paths with spaces and escapes specifiers', () => {
    expect(quoteExecArg('/opt/my app/bin')).toBe('"/opt/my app/bin"');
    expect(quoteExecArg('/opt/100%/bin')).toBe('/opt/100%%/bin');
    expect(quoteExecArg('/plain/bin')).toBe('/plain/bin');
  });

  test('writes <name>.service into cwd for the current user', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'makuro-unit-'));
    const file = await writeSystemdUnit({ execPath: '/opt/app/bin', cwd: dir, user: 'deploy' });
    expect(file).toBe(path.join(dir, `${PKG_NAME}.service`));
    expect(await Bun.file(file).text()).toContain('User=deploy');
  });

  test('refuses root', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'makuro-unit-'));
    await expect(writeSystemdUnit({ execPath: '/x', cwd: dir, user: 'root' })).rejects.toThrow(
      /root/,
    );
    const uid = spyOn(process, 'getuid').mockReturnValue(0);
    await expect(writeSystemdUnit({ execPath: '/x', cwd: dir })).rejects.toThrow(/root/);
    uid.mockRestore();
  });
});

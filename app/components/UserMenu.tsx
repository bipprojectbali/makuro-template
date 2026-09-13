import { Avatar, Group, Loader, Menu, Text, UnstyledButton } from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  type AccountOption,
  type DeviceSessionEntry,
  toAccountOptions,
} from '@server/session-accounts';
import { useState } from 'react';
import { FiCheck, FiLogOut, FiMoreVertical, FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router';
import type { AppUser } from '~/lib/app-context';
import { authClient, signOut, useSession } from '~/lib/auth-client';

/**
 * Avatar + account switcher shared by every area layout. Switching lands on /go
 * so the target account's role decides its home (strict isolation), never a
 * hardcoded area.
 */
export function UserMenu({
  user,
  collapsed = false,
  roleBadge,
}: {
  user: AppUser;
  collapsed?: boolean;
  /** Role chip rendered next to the name (expanded) and in the menu header. */
  roleBadge?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { data } = useSession();
  const current = data?.user ?? user;

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    const { data: sessions } = await authClient.multiSession.listDeviceSessions();
    const activeToken = (data?.session as { token?: string } | undefined)?.token;
    setAccounts(toAccountOptions((sessions ?? []) as unknown as DeviceSessionEntry[], activeToken));
    setLoading(false);
  }

  async function switchAccount(token: string) {
    setSwitching(true);
    const { error } = await authClient.multiSession.setActive({ sessionToken: token });
    if (error) {
      setSwitching(false);
      return;
    }
    // Full reload through /go so loaders re-run and route to the new role's home.
    window.location.assign('/go');
  }

  return (
    <Menu position="right-end" withArrow width={240} onOpen={loadAccounts}>
      <Menu.Target>
        <UnstyledButton
          style={{
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
            padding: 8,
            borderRadius: 8,
          }}
          aria-label="Menu akun"
        >
          <Group gap="sm" wrap="nowrap" w="100%">
            <Avatar
              src={current.image}
              radius="xl"
              size={34}
              name={current.name}
              color="initials"
              imageProps={{ referrerPolicy: 'no-referrer' }}
            />
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={500} truncate style={{ minWidth: 0 }}>
                      {current.name}
                    </Text>
                    {roleBadge}
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {current.email}
                  </Text>
                </div>
                <FiMoreVertical size={14} style={{ flexShrink: 0, opacity: 0.4 }} />
              </>
            )}
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Group gap={6} wrap="nowrap">
            <Text size="xs" truncate style={{ minWidth: 0 }}>
              {current.email}
            </Text>
            {roleBadge}
          </Group>
        </Menu.Label>
        <Menu.Divider />
        <Menu.Label>Akun</Menu.Label>
        {loading ? (
          <Group justify="center" py="xs">
            <Loader size="xs" />
          </Group>
        ) : (
          accounts.map((acc) => (
            <Menu.Item
              key={acc.token}
              disabled={acc.active || switching}
              leftSection={
                <Avatar
                  src={acc.image}
                  radius="xl"
                  size={24}
                  name={acc.name}
                  color="initials"
                  imageProps={{ referrerPolicy: 'no-referrer' }}
                />
              }
              rightSection={acc.active ? <FiCheck size={14} /> : undefined}
              onClick={() => switchAccount(acc.token)}
            >
              <div style={{ minWidth: 0 }}>
                <Text size="sm" truncate>
                  {acc.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {acc.email}
                </Text>
              </div>
            </Menu.Item>
          ))
        )}
        <Menu.Item leftSection={<FiPlus size={16} />} onClick={() => navigate('/login')}>
          Tambah akun lain
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<FiLogOut size={16} />}
          onClick={() =>
            modals.openConfirmModal({
              title: 'Keluar dari akun ini?',
              children: (
                <Text size="sm">Kamu akan keluar dari akun ini. Sesi aktif akan dihapus.</Text>
              ),
              labels: { confirm: 'Keluar', cancel: 'Batal' },
              confirmProps: { color: 'red' },
              onConfirm: async () => {
                await signOut();
                navigate('/login');
              },
            })
          }
        >
          Keluar
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

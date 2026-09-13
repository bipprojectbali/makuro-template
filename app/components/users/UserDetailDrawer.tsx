import { Alert, Avatar, Badge, Button, Divider, Drawer, Group, Stack, Text } from '@mantine/core';
import { normalizeRole, ROLES } from '@server/permissions';
import { FiLogIn, FiShield, FiSlash, FiTrash2, FiUser, FiUserCheck } from 'react-icons/fi';
import { type AdminUser, isBanActive } from '~/lib/admin-users-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { Copyable, Field, Section } from '../logs/DetailParts';
import { allowedActions, type UserPermissions } from './UserActionsMenu';
import { RoleBadge, StatusBadge } from './UserCells';
import type { useUserActions } from './useUserActions';

type Props = {
  user: AdminUser | null;
  onClose: () => void;
  perms: UserPermissions;
  actions: ReturnType<typeof useUserActions>;
};

const nf = new Intl.NumberFormat('id-ID');

/** Full profile + permitted actions for one user. */
export function UserDetailDrawer({ user, onClose, perms, actions }: Props) {
  const can = user ? allowedActions(user, perms) : null;
  const busy = user ? actions.busyId === user.id : false;
  const banned = user ? isBanActive(user) : false;
  const target = user ? normalizeRole(user.role) : ROLES.USER;
  return (
    <Drawer
      opened={user !== null}
      onClose={onClose}
      position="right"
      size="md"
      title="Detail user"
      padding="md"
    >
      {user && can && (
        <Stack gap="lg">
          <Group wrap="nowrap" align="flex-start">
            <Avatar
              src={user.image}
              radius="xl"
              size={56}
              name={user.name}
              color="initials"
              imageProps={{ referrerPolicy: 'no-referrer' }}
            />
            <Stack gap={4} style={{ minWidth: 0 }}>
              <Text fw={600} size="lg" lh={1.2} style={{ wordBreak: 'break-word' }}>
                {user.name}
              </Text>
              <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
                {user.email}
              </Text>
              <Group gap="xs">
                <RoleBadge role={user.role} />
                <StatusBadge user={user} />
                <Badge
                  size="sm"
                  variant={user.emailVerified ? 'light' : 'outline'}
                  color={user.emailVerified ? 'teal' : 'gray'}
                >
                  {user.emailVerified ? 'Email terverifikasi' : 'Belum verifikasi'}
                </Badge>
              </Group>
            </Stack>
          </Group>

          {banned && (
            <Alert
              color="red"
              variant="light"
              icon={<FiSlash size={16} />}
              title="User ini diblokir"
            >
              {user.banReason ? `Alasan: ${user.banReason}. ` : 'Tanpa alasan tercatat. '}
              {user.banExpires
                ? `Berakhir ${formatDateTime(user.banExpires)}.`
                : 'Permanen sampai dibuka manual.'}
            </Alert>
          )}

          <Section title="Aktivitas">
            <Field label="Login terakhir">
              <Text size="sm">
                {user.lastLoginAt
                  ? `${formatRelative(user.lastLoginAt)} · ${formatDateTime(user.lastLoginAt)}`
                  : 'Belum pernah'}
              </Text>
            </Field>
            <Field label="Total login">
              <Text size="sm">{nf.format(user.loginCount)}</Text>
            </Field>
            <Field label="Sesi aktif">
              <Text size="sm">{nf.format(user.activeSessions)}</Text>
            </Field>
            <Field label="Bergabung">
              <Text size="sm">{formatDateTime(user.createdAt)}</Text>
            </Field>
          </Section>
          <Divider />

          <Section title="Akun">
            <Field label="User ID">
              <Copyable value={user.id} />
            </Field>
            <Field label="Provider">
              <Group gap={4} justify="flex-end">
                {user.providers.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                ) : (
                  user.providers.map((p) => (
                    <Badge
                      key={p}
                      size="sm"
                      variant="light"
                      color={p === 'credential' ? 'gray' : 'indigo'}
                    >
                      {p === 'credential' ? 'email & password' : p}
                    </Badge>
                  ))
                )}
              </Group>
            </Field>
          </Section>
          <Divider />

          <Section title="Aksi">
            {!can.role && !can.ban && !can.impersonate && !can.remove ? (
              <Text size="sm" c="dimmed">
                {can.isSelf
                  ? 'Ini akun Anda sendiri.'
                  : target === ROLES.SUPER_ADMIN
                    ? 'Super-admin dikelola lewat SUPER_ADMIN_EMAILS di env.'
                    : 'Role Anda tidak bisa mengubah user ini.'}
              </Text>
            ) : (
              <Stack gap="xs">
                {can.role && target !== ROLES.ADMIN && (
                  <Button
                    variant="light"
                    leftSection={<FiShield size={14} />}
                    loading={busy}
                    onClick={() => actions.changeRole(user, ROLES.ADMIN)}
                  >
                    Jadikan admin
                  </Button>
                )}
                {can.role && target !== ROLES.USER && (
                  <Button
                    variant="light"
                    color="orange"
                    leftSection={<FiUser size={14} />}
                    loading={busy}
                    onClick={() => actions.changeRole(user, ROLES.USER)}
                  >
                    Jadikan user biasa
                  </Button>
                )}
                {can.impersonate && (
                  <Button
                    variant="light"
                    color="gray"
                    leftSection={<FiLogIn size={14} />}
                    loading={busy}
                    onClick={() => actions.impersonate(user)}
                  >
                    Masuk sebagai user ini
                  </Button>
                )}
                {can.ban &&
                  (banned ? (
                    <Button
                      variant="light"
                      color="teal"
                      leftSection={<FiUserCheck size={14} />}
                      loading={busy}
                      onClick={() => actions.unbanConfirm(user)}
                    >
                      Buka ban
                    </Button>
                  ) : (
                    <Button
                      variant="light"
                      color="orange"
                      leftSection={<FiSlash size={14} />}
                      loading={busy}
                      onClick={() => actions.banWithForm(user)}
                    >
                      Ban user…
                    </Button>
                  ))}
                {can.remove && (
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<FiTrash2 size={14} />}
                    loading={busy}
                    onClick={() => actions.removeConfirm(user)}
                  >
                    Hapus permanen…
                  </Button>
                )}
              </Stack>
            )}
          </Section>
        </Stack>
      )}
    </Drawer>
  );
}

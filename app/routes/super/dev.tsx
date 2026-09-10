import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  canActOnTarget,
  canImpersonate,
  canSetRole,
  isAdminRole,
  normalizeRole,
  ROLES,
  type Role,
} from '@server/permissions';
import { useEffect, useState } from 'react';
import { FiLogIn, FiSearch, FiSlash, FiTrash2, FiUserCheck } from 'react-icons/fi';
import { useApp } from '~/lib/app-context';
import { authClient } from '~/lib/auth-client';
import { client } from '~/lib/eden';

export function meta() {
  return [{ title: 'Users — Makuro Dev' }];
}

const PAGE_SIZE = 20;

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role?: string | null;
  banned?: boolean | null;
  createdAt: string | Date;
};

export default function Dev() {
  const { user, role: actorRole } = useApp();
  const currentUserId = user.id;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await client.api.admin.users.get({
      query: {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: search.trim() || undefined,
      },
    });
    if (err) {
      setError('Failed to load users');
      setUsers([]);
    } else {
      setUsers((data?.users ?? []) as AdminUser[]);
      setTotal(data?.total ?? 0);
    }
    setLoading(false);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load is stable enough for this view
  useEffect(() => {
    load();
  }, [page, search]);

  async function run(id: string, fn: () => Promise<{ error?: unknown }>) {
    setBusyId(id);
    setError(null);
    const res = await fn();
    if (res?.error) setError('Action failed');
    await load();
    setBusyId(null);
  }

  async function impersonate(id: string) {
    setBusyId(id);
    const { error: err } = await authClient.admin.impersonateUser({ userId: id });
    setBusyId(null);
    if (err) {
      setError('Impersonation failed');
      return;
    }
    // Land on /go so the impersonated user's role decides their home.
    window.location.assign('/go');
  }

  const rows = users.map((u) => {
    const target = normalizeRole(u.role);
    const isSelf = u.id === currentUserId;
    const busy = busyId === u.id;
    const editableRole = canSetRole(actorRole) && !isSelf && target !== ROLES.SUPER_ADMIN;
    const canBan = !isSelf && target !== ROLES.SUPER_ADMIN && canActOnTarget(actorRole, target);

    return (
      <Table.Tr key={u.id}>
        <Table.Td>
          <Text fw={500}>{u.name}</Text>
          <Text size="xs" c="dimmed">
            {u.email}
          </Text>
        </Table.Td>
        <Table.Td>
          {editableRole ? (
            <Select
              size="xs"
              w={130}
              disabled={busy}
              value={target}
              data={[
                { value: ROLES.USER, label: 'user' },
                { value: ROLES.ADMIN, label: 'admin' },
              ]}
              onChange={(val) => {
                if (!val || val === target) return;
                const newRole = val as Role;
                modals.openConfirmModal({
                  title: 'Ubah role pengguna?',
                  children: (
                    <Text size="sm">
                      Role <b>{u.name}</b> akan diubah dari <b>{target}</b> ke <b>{newRole}</b>.
                    </Text>
                  ),
                  labels: { confirm: 'Ubah role', cancel: 'Batal' },
                  onCancel: () => setUsers((prev) => [...prev]),
                  onConfirm: () =>
                    run(u.id, () =>
                      client.api.admin.users({ id: u.id }).role.post({ role: newRole }),
                    ),
                });
              }}
            />
          ) : (
            <Badge variant="light" color={isAdminRole(target) ? 'blue' : 'gray'}>
              {target}
            </Badge>
          )}
        </Table.Td>
        <Table.Td>
          {u.banned ? (
            <Badge color="red" variant="light">
              banned
            </Badge>
          ) : (
            <Badge color="green" variant="light">
              active
            </Badge>
          )}
        </Table.Td>
        <Table.Td>
          <Text size="xs">{new Date(u.createdAt).toLocaleDateString()}</Text>
        </Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            {canBan &&
              (u.banned ? (
                <Button
                  size="xs"
                  variant="light"
                  loading={busy}
                  leftSection={<FiUserCheck size={14} />}
                  onClick={() =>
                    run(u.id, () => client.api.admin.users({ id: u.id }).unban.post({}))
                  }
                >
                  Unban
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  loading={busy}
                  leftSection={<FiSlash size={14} />}
                  onClick={() =>
                    modals.openConfirmModal({
                      title: 'Ban pengguna?',
                      children: (
                        <Text size="sm">
                          <b>{u.name}</b> tidak akan bisa login. Kamu bisa unban kapan saja.
                        </Text>
                      ),
                      labels: { confirm: 'Ban pengguna', cancel: 'Batal' },
                      confirmProps: { color: 'red' },
                      onConfirm: () =>
                        run(u.id, () => client.api.admin.users({ id: u.id }).ban.post({})),
                    })
                  }
                >
                  Ban
                </Button>
              ))}
            {canImpersonate(actorRole) && !isSelf && target !== ROLES.SUPER_ADMIN && (
              <Button
                size="xs"
                variant="subtle"
                loading={busy}
                leftSection={<FiLogIn size={14} />}
                onClick={() => impersonate(u.id)}
              >
                Impersonate
              </Button>
            )}
            {canSetRole(actorRole) && !isSelf && target !== ROLES.SUPER_ADMIN && (
              <ActionIcon
                variant="subtle"
                color="red"
                loading={busy}
                aria-label="Hapus pengguna"
                onClick={() =>
                  modals.openConfirmModal({
                    title: 'Hapus pengguna?',
                    children: (
                      <Text size="sm">
                        <b>{u.name}</b> akan dihapus permanen beserta semua sesinya. Aksi ini tidak
                        bisa dibatalkan.
                      </Text>
                    ),
                    labels: { confirm: 'Hapus permanen', cancel: 'Batal' },
                    confirmProps: { color: 'red' },
                    onConfirm: () =>
                      run(u.id, () => client.api.admin.users({ id: u.id }).delete()),
                  })
                }
              >
                <FiTrash2 size={16} />
              </ActionIcon>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Stack>
      <Title order={2}>Users</Title>
      <TextInput
        placeholder="Search by email"
        leftSection={<FiSearch size={16} />}
        value={search}
        maxLength={100}
        onChange={(e) => {
          setPage(1);
          setSearch(e.currentTarget.value);
        }}
      />
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      {loading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Joined</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length > 0 ? (
                rows
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" py="md" ta="center">
                      {search
                        ? `Tidak ada pengguna yang cocok dengan "${search}"`
                        : 'Belum ada pengguna.'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {pageCount > 1 && (
        <Group justify="flex-end">
          <Pagination value={page} onChange={setPage} total={pageCount} />
        </Group>
      )}
    </Stack>
  );
}

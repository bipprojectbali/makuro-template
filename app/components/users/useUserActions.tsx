import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type AdminUser, banUser, deleteUser, setUserRole, unbanUser } from '~/lib/admin-users-api';
import { authClient } from '~/lib/auth-client';
import { BanUserForm } from './BanUserForm';

function notifyError(title: string, err: unknown) {
  notifications.show({
    color: 'red',
    title,
    message: err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.',
  });
}

/** Role / ban / delete / impersonate with confirm dialogs, loading state and feedback. */
export function useUserActions({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-users'] }),
      qc.invalidateQueries({ queryKey: ['admin-users-stats'] }),
    ]);

  // Shared lifecycle for every mutation (hooks themselves stay at top level).
  const lifecycle = <TArgs,>(
    id: (a: TArgs) => string,
    success: (a: TArgs) => string,
    errTitle: string,
  ) => ({
    onMutate: (a: TArgs) => setBusyId(id(a)),
    onSettled: () => setBusyId(null),
    onSuccess: async (_r: unknown, a: TArgs) => {
      await invalidate();
      notifications.show({ color: 'teal', message: success(a) });
      onDone();
    },
    onError: (e: unknown) => notifyError(errTitle, e),
  });

  const role = useMutation({
    mutationFn: (a: { user: AdminUser; role: string }) => setUserRole(a.user.id, a.role),
    ...lifecycle<{ user: AdminUser; role: string }>(
      (a) => a.user.id,
      (a) => `Role ${a.user.name} diubah menjadi ${a.role}.`,
      'Gagal mengubah role',
    ),
  });
  const ban = useMutation({
    mutationFn: (a: { user: AdminUser; reason: string; expiresIn?: number }) =>
      banUser(a.user.id, a.reason, a.expiresIn),
    ...lifecycle<{ user: AdminUser; reason: string; expiresIn?: number }>(
      (a) => a.user.id,
      (a) => `${a.user.name} diblokir${a.expiresIn ? ' sementara' : ' permanen'}.`,
      'Gagal memblokir user',
    ),
  });
  const unban = useMutation({
    mutationFn: (u: AdminUser) => unbanUser(u.id),
    ...lifecycle<AdminUser>(
      (u) => u.id,
      (u) => `Ban ${u.name} dibuka.`,
      'Gagal membuka ban',
    ),
  });
  const remove = useMutation({
    mutationFn: (u: AdminUser) => deleteUser(u.id),
    ...lifecycle<AdminUser>(
      (u) => u.id,
      (u) => `${u.name} dihapus permanen.`,
      'Gagal menghapus user',
    ),
  });

  const changeRole = (user: AdminUser, next: string) =>
    modals.openConfirmModal({
      title: `Ubah role menjadi ${next}?`,
      children: (
        <Text size="sm">
          <strong>{user.name}</strong> ({user.email}) akan menjadi <strong>{next}</strong>.{' '}
          {next === 'admin'
            ? 'Admin bisa melihat dan memblokir user biasa di dashboard.'
            : 'Akses admin dicabut segera.'}
        </Text>
      ),
      labels: { confirm: `Jadikan ${next}`, cancel: 'Batal' },
      confirmProps: { color: next === 'admin' ? 'blue' : 'orange' },
      onConfirm: () => role.mutate({ user, role: next }),
    });

  const banWithForm = (user: AdminUser) => {
    const id = modals.open({
      title: `Ban ${user.name}?`,
      children: (
        <BanUserForm
          user={user}
          onCancel={() => modals.close(id)}
          onSubmit={(reason, expiresIn) => {
            modals.close(id);
            ban.mutate({ user, reason, expiresIn });
          }}
        />
      ),
    });
  };

  const unbanConfirm = (user: AdminUser) =>
    modals.openConfirmModal({
      title: 'Buka ban?',
      children: (
        <Text size="sm">
          <strong>{user.name}</strong> bisa masuk kembali segera setelah ban dibuka.
        </Text>
      ),
      labels: { confirm: 'Buka ban', cancel: 'Batal' },
      onConfirm: () => unban.mutate(user),
    });

  const removeConfirm = (user: AdminUser) =>
    modals.openConfirmModal({
      title: 'Hapus user permanen?',
      children: (
        <Text size="sm">
          <strong>{user.name}</strong> ({user.email}) beserta sesi dan akun tertautnya akan dihapus
          permanen. Tindakan ini tidak bisa dibatalkan. Pertimbangkan ban bila hanya ingin menutup
          akses.
        </Text>
      ),
      labels: { confirm: 'Hapus permanen', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(user),
    });

  const impersonate = (user: AdminUser) =>
    modals.openConfirmModal({
      title: `Masuk sebagai ${user.name}?`,
      children: (
        <Text size="sm">
          Anda akan melihat aplikasi persis seperti user ini selama 1 jam. Tindakan tercatat di
          login log sebagai impersonasi. Gunakan tombol "Berhenti impersonasi" di sidebar untuk
          kembali.
        </Text>
      ),
      labels: { confirm: 'Masuk sebagai user', cancel: 'Batal' },
      onConfirm: async () => {
        setBusyId(user.id);
        const { error } = await authClient.admin.impersonateUser({ userId: user.id });
        setBusyId(null);
        if (error)
          return notifyError('Impersonasi gagal', new Error(error.message ?? 'Ditolak server'));
        // Land on /go so the impersonated user's role decides their home.
        window.location.assign('/go');
      },
    });

  return { changeRole, banWithForm, unbanConfirm, removeConfirm, impersonate, busyId };
}

import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { revokeSession, revokeUserSessions, type SessionRow } from '~/lib/sessions-api';

const nf = new Intl.NumberFormat('id-ID');

/** Revoke one session / all sessions of a user, with confirmation and feedback. */
export function useSessionActions(currentSessionId: string | null) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['sessions'] }),
      qc.invalidateQueries({ queryKey: ['sessions-stats'] }),
    ]);
  const fail = (title: string) => (e: Error) =>
    notifications.show({ color: 'red', title, message: e.message });

  const one = useMutation({
    mutationFn: (s: SessionRow) => revokeSession(s.id),
    onMutate: (s) => setBusyId(s.id),
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await invalidate();
      notifications.show({
        color: 'teal',
        message: 'Sesi dicabut. Perangkat itu harus masuk ulang.',
      });
    },
    onError: fail('Gagal mencabut sesi'),
  });
  const all = useMutation({
    // Never revoke the admin's own session from this screen.
    mutationFn: (s: SessionRow) => revokeUserSessions(s.userId, currentSessionId ?? undefined),
    onMutate: (s) => setBusyId(s.userId),
    onSettled: () => setBusyId(null),
    onSuccess: async (r) => {
      await invalidate();
      notifications.show({ color: 'teal', message: `${nf.format(r.revoked)} sesi dicabut.` });
    },
    onError: fail('Gagal mencabut sesi user'),
  });

  const onRevoke = (s: SessionRow) =>
    modals.openConfirmModal({
      title: 'Cabut sesi ini?',
      children: (
        <Text size="sm">
          Perangkat <strong>{s.userName ?? s.userEmail}</strong> ini akan langsung keluar dan harus
          masuk ulang.
        </Text>
      ),
      labels: { confirm: 'Cabut sesi', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => one.mutate(s),
    });
  const onRevokeUser = (s: SessionRow) =>
    modals.openConfirmModal({
      title: `Cabut semua sesi ${s.userName ?? s.userEmail}?`,
      children: (
        <Text size="sm">
          Semua perangkat user ini keluar sekaligus. Sesi Anda sendiri tidak ikut dicabut.
        </Text>
      ),
      labels: { confirm: 'Cabut semua sesi', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => all.mutate(s),
    });

  return { busyId, onRevoke, onRevokeUser };
}

import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteVisit, deleteVisits, purgeLogs, type VisitRow } from '~/lib/visits-api';
import { formatDateTime } from '~/lib/visits-format';

const PURGE_DAYS = 30;
const nf = new Intl.NumberFormat('id-ID');

function notifyError(title: string, err: unknown) {
  notifications.show({
    color: 'red',
    title,
    message: err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.',
  });
}

/** Destructive visit-log actions with confirm dialogs, loading state, and feedback. */
export function useVisitActions({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['visits'] }),
      qc.invalidateQueries({ queryKey: ['visits-stats'] }),
    ]);

  const single = useMutation({
    mutationFn: (id: string) => deleteVisit(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: async () => {
      await invalidate();
      notifications.show({ color: 'teal', message: 'Kunjungan dihapus.' });
      onDone();
    },
    onError: (e) => notifyError('Gagal menghapus kunjungan', e),
  });

  const bulk = useMutation({
    mutationFn: (ids: string[]) => deleteVisits(ids),
    onSuccess: async (r) => {
      await invalidate();
      notifications.show({ color: 'teal', message: `${nf.format(r.deleted)} kunjungan dihapus.` });
      onDone();
    },
    onError: (e) => notifyError('Gagal menghapus kunjungan terpilih', e),
  });

  const purge = useMutation({
    mutationFn: (days: number) => purgeLogs(days),
    onSuccess: async (r, days) => {
      await invalidate();
      notifications.show({
        color: 'teal',
        title: days === 0 ? 'Semua log dihapus' : `Log lebih dari ${days} hari dihapus`,
        message: `${nf.format(r.purgedVisits)} visit log dibersihkan (login & rate-limit log ikut dibersihkan).`,
      });
      onDone();
    },
    onError: (e) => notifyError('Gagal membersihkan log', e),
  });

  const deleteOne = (row: VisitRow) =>
    modals.openConfirmModal({
      title: 'Hapus kunjungan',
      children: (
        <Text size="sm">
          Catatan kunjungan ke <code>{row.path}</code> pada {formatDateTime(row.createdAt)} akan
          dihapus permanen.
        </Text>
      ),
      labels: { confirm: 'Hapus kunjungan', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => single.mutate(row.id),
    });

  const deleteMany = (ids: string[]) =>
    modals.openConfirmModal({
      title: `Hapus ${nf.format(ids.length)} kunjungan`,
      children: (
        <Text size="sm">
          Semua kunjungan yang dipilih akan dihapus permanen dan tidak bisa dikembalikan.
        </Text>
      ),
      labels: { confirm: `Hapus ${nf.format(ids.length)} kunjungan`, cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => bulk.mutate(ids),
    });

  const purgeOld = () =>
    modals.openConfirmModal({
      title: `Purge log lebih dari ${PURGE_DAYS} hari`,
      children: (
        <Text size="sm">
          Semua visit log, login log, dan rate-limit log yang lebih tua dari {PURGE_DAYS} hari akan
          dihapus permanen. Data terbaru tetap dipertahankan.
        </Text>
      ),
      labels: { confirm: `Purge ${PURGE_DAYS} hari+`, cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => purge.mutate(PURGE_DAYS),
    });

  const clearAll = () =>
    modals.openConfirmModal({
      title: 'Hapus semua log',
      children: (
        <Text size="sm">
          <strong>Semua</strong> visit log, login log, dan rate-limit log — termasuk yang baru saja
          tercatat — akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
        </Text>
      ),
      labels: { confirm: 'Hapus semua log', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => purge.mutate(0),
    });

  return {
    deleteOne,
    deleteMany,
    purgeOld,
    clearAll,
    deletingId,
    bulkDeleting: bulk.isPending,
    purging: purge.isPending,
  };
}

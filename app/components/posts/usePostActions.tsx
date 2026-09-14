import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createPost, deletePost, type PostInput, type PostRow, updatePost } from '~/lib/posts-api';
import { PostForm } from './PostForm';

/** Create / edit (modal form) / delete with feedback. */
export function usePostActions() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['posts'] }),
      qc.invalidateQueries({ queryKey: ['posts-stats'] }),
    ]);
  const fail = (title: string) => (e: Error) =>
    notifications.show({ color: 'red', title, message: e.message });

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: PostInput }) =>
      id ? updatePost(id, input) : createPost(input),
    onSuccess: async (_r, v) => {
      await invalidate();
      modals.closeAll();
      notifications.show({ color: 'teal', message: v.id ? 'Post disimpan.' : 'Post diterbitkan.' });
    },
    onError: fail('Gagal menyimpan post'),
  });
  const remove = useMutation({
    mutationFn: (p: PostRow) => deletePost(p.id),
    onMutate: (p) => setBusyId(p.id),
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await invalidate();
      notifications.show({ color: 'teal', message: 'Post dihapus.' });
    },
    onError: fail('Gagal menghapus post'),
  });

  const openForm = (initial: PostRow | null) =>
    modals.open({
      title: initial ? 'Edit post' : 'Post baru',
      size: 'lg',
      children: (
        <PostForm
          initial={initial}
          busy={save.isPending}
          onCancel={() => modals.closeAll()}
          onSubmit={(input) => save.mutate({ id: initial?.id ?? null, input })}
        />
      ),
    });
  const confirmDelete = (p: PostRow) =>
    modals.openConfirmModal({
      title: 'Hapus post?',
      children: (
        <Text size="sm">
          <strong>{p.title}</strong> milik {p.authorName ?? p.authorEmail} akan dihapus permanen.
          Penghapusan post orang lain dicatat di Audit Log.
        </Text>
      ),
      labels: { confirm: 'Hapus post', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(p),
    });

  return { openForm, confirmDelete, busyId };
}

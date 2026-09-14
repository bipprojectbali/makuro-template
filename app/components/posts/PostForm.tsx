import { Button, Group, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { PostInput, PostRow } from '~/lib/posts-api';

const TITLE_MAX = 200;
const CONTENT_MAX = 20_000;

/** Create/edit body used inside a modal. */
export function PostForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial?: PostRow | null;
  onSubmit: (input: PostInput) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const titleError =
    title.trim().length === 0
      ? 'Judul wajib diisi'
      : title.length > TITLE_MAX
        ? `Maksimal ${TITLE_MAX} karakter`
        : null;
  return (
    <Stack gap="sm">
      <TextInput
        label="Judul"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        maxLength={TITLE_MAX}
        error={title && titleError}
        required
        data-autofocus
      />
      <Textarea
        label="Isi"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        maxLength={CONTENT_MAX}
        autosize
        minRows={6}
        maxRows={18}
        description={`${content.length.toLocaleString('id-ID')} / ${CONTENT_MAX.toLocaleString('id-ID')} karakter`}
      />
      {initial && (
        <Text size="xs" c="dimmed">
          Penulis: {initial.authorName ?? initial.authorEmail ?? initial.authorId}
        </Text>
      )}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button
          onClick={() => onSubmit({ title: title.trim(), content: content.trim() || null })}
          loading={busy}
          disabled={Boolean(titleError)}
        >
          {initial ? 'Simpan perubahan' : 'Terbitkan post'}
        </Button>
      </Group>
    </Stack>
  );
}

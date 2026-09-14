import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Code,
  CopyButton,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import { FiAlertTriangle, FiCheck, FiCopy } from 'react-icons/fi';
import { formatDateTime } from '~/lib/visits-format';
import type { Reveal } from './useApiKeyActions';

/** Shows the plain key exactly once. Closing is gated by an explicit "I saved it" check. */
export function RevealKeyModal({
  reveal,
  onClose,
}: {
  reveal: Reveal | null;
  onClose: () => void;
}) {
  // Body is keyed by key id so the "saved" acknowledgement resets for every new key.
  return reveal ? <RevealBody key={reveal.row.id} reveal={reveal} onClose={onClose} /> : null;
}

function RevealBody({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const example = `curl -H "X-API-Key: ${reveal.key}" ${origin}/api/me/logins`;
  return (
    <Modal
      opened
      onClose={() => saved && onClose()}
      title={reveal.rotatedFrom ? 'Kunci baru hasil rotasi' : 'API key berhasil dibuat'}
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Stack gap="md">
        <Alert color="yellow" icon={<FiAlertTriangle size={16} />} title="Ditampilkan sekali saja">
          Simpan kunci ini sekarang di secret manager atau env integrasi Anda. Setelah jendela ini
          ditutup, kunci tidak bisa dilihat lagi — hanya bisa dirotasi.
        </Alert>
        <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-default-hover)">
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all', minWidth: 0 }}>
              {reveal.key}
            </Text>
            <CopyButton value={reveal.key} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Tersalin' : 'Salin kunci'} withArrow>
                  <ActionIcon
                    variant="light"
                    color={copied ? 'teal' : 'blue'}
                    size="lg"
                    onClick={copy}
                    aria-label="Salin kunci"
                    style={{ flexShrink: 0 }}
                  >
                    {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </Paper>
        <Stack gap={4}>
          <Text size="sm">
            <strong>{reveal.row.name}</strong> · pemilik{' '}
            {reveal.row.ownerEmail ?? reveal.row.ownerId}
            {' · '}
            {reveal.row.expiresAt
              ? `berakhir ${formatDateTime(reveal.row.expiresAt)}`
              : 'tanpa kedaluwarsa'}
          </Text>
          <Text size="xs" c="dimmed">
            Scope: {reveal.row.scopes.join(', ') || 'tanpa scope'}
          </Text>
          {reveal.rotatedFrom && (
            <Text size="xs" c="dimmed">
              Kunci lama masih diterima sampai{' '}
              {reveal.rotatedFrom.expiresAt
                ? formatDateTime(reveal.rotatedFrom.expiresAt)
                : 'masa tenggang berakhir'}
              .
            </Text>
          )}
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
            Contoh pemakaian
          </Text>
          <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {example}
          </Code>
          <Text size="xs" c="dimmed">
            Kirim lewat header <Code>X-API-Key</Code> atau <Code>Authorization: Bearer</Code>.
          </Text>
        </Stack>
        <Checkbox
          checked={saved}
          onChange={(e) => setSaved(e.currentTarget.checked)}
          label="Saya sudah menyimpan kunci ini di tempat yang aman"
        />
        <Group justify="flex-end">
          <Button disabled={!saved} onClick={onClose}>
            Tutup
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

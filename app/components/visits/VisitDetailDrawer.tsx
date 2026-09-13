import {
  ActionIcon,
  Anchor,
  Button,
  Code,
  CopyButton,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { FiCheck, FiCopy, FiExternalLink, FiTrash2 } from 'react-icons/fi';
import type { VisitRow } from '~/lib/visits-api';
import {
  botKindLabel,
  countryFlag,
  deviceLabel,
  formatDateTime,
  formatRelative,
  locationLabel,
} from '~/lib/visits-format';
import { DeviceIcon, TypeBadge, UserCell } from './VisitCells';

type Props = {
  row: VisitRow | null;
  onClose: () => void;
  onDelete: (row: VisitRow) => void;
  deleting: boolean;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0, width: 110 }}>
        {label}
      </Text>
      <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>{children}</div>
    </Group>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
        {title}
      </Text>
      {children}
    </Stack>
  );
}

function Copyable({ value }: { value: string }) {
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Text ff="monospace" size="sm" truncate style={{ minWidth: 0 }}>
        {value}
      </Text>
      <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Tersalin' : 'Salin'} withArrow>
            <ActionIcon
              variant="subtle"
              color={copied ? 'teal' : 'gray'}
              size="sm"
              onClick={copy}
              aria-label="Salin"
            >
              {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

const dash = (v: string | null | undefined) => v || '—';

/** Full record view for one visit — everything the middleware captured, plus a delete action. */
export function VisitDetailDrawer({ row, onClose, onDelete, deleting }: Props) {
  return (
    <Drawer
      opened={row !== null}
      onClose={onClose}
      position="right"
      size="md"
      title="Detail kunjungan"
      padding="md"
    >
      {row && (
        <Stack gap="lg">
          <Group justify="space-between" wrap="nowrap">
            <TypeBadge row={row} />
            <Text size="sm" c="dimmed">
              {formatRelative(row.createdAt)}
            </Text>
          </Group>

          <Section title="Waktu">
            <Field label="Tercatat">
              <Text size="sm">{formatDateTime(row.createdAt)}</Text>
            </Field>
          </Section>
          <Divider />

          <Section title="Pengunjung">
            <Field label="IP">
              {row.ip ? <Copyable value={row.ip} /> : <Text size="sm">—</Text>}
            </Field>
            <Field label="Lokasi">
              <Text size="sm">
                {countryFlag(row.country)} {locationLabel(row)}
              </Text>
            </Field>
            {row.region && (
              <Field label="Wilayah">
                <Text size="sm">{row.region}</Text>
              </Field>
            )}
            <Field label="Bahasa">
              <Text size="sm">{dash(row.language)}</Text>
            </Field>
            <Field label="User">
              <Group justify="flex-end">
                <UserCell row={row} />
              </Group>
            </Field>
          </Section>
          <Divider />

          <Section title="Halaman">
            <Field label="Path">
              <Copyable value={row.path} />
            </Field>
            <Field label="Referer">
              {row.referer ? (
                <Anchor
                  href={row.referer}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  style={{ wordBreak: 'break-all' }}
                >
                  {row.referer} <FiExternalLink size={11} />
                </Anchor>
              ) : (
                <Text size="sm">Langsung / tidak ada</Text>
              )}
            </Field>
          </Section>
          <Divider />

          <Section title="Perangkat">
            <Field label="Jenis">
              <Group gap="xs" justify="flex-end" wrap="nowrap">
                <DeviceIcon type={row.deviceType} size={12} />
                <Text size="sm">
                  {row.isBot ? botKindLabel(row.botKind) : deviceLabel(row.deviceType)}
                </Text>
              </Group>
            </Field>
            <Field label="Browser">
              <Text size="sm">
                {row.browser
                  ? `${row.browser} ${row.browserVersion ?? ''}`.trim()
                  : 'Tidak dikenali'}
              </Text>
            </Field>
            <Field label="Sistem operasi">
              <Text size="sm">
                {row.os ? `${row.os} ${row.osVersion ?? ''}`.trim() : 'Tidak dikenali'}
              </Text>
            </Field>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                User agent
              </Text>
              <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
                {dash(row.userAgent)}
              </Code>
            </Stack>
          </Section>
          <Divider />

          <Field label="ID">
            <Copyable value={row.id} />
          </Field>

          <Button
            color="red"
            variant="light"
            leftSection={<FiTrash2 size={14} />}
            loading={deleting}
            onClick={() => onDelete(row)}
            fullWidth
          >
            Hapus kunjungan ini
          </Button>
        </Stack>
      )}
    </Drawer>
  );
}

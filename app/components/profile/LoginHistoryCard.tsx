import { Group, Stack, Text, Tooltip } from '@mantine/core';
import type { LoginRow } from '~/lib/login-logs-api';
import { methodMeta } from '~/lib/login-logs-api';
import {
  countryFlag,
  deviceSummary,
  formatDateTime,
  formatRelative,
  locationLabel,
} from '~/lib/visits-format';
import { MethodBadge } from '../login-logs/LoginCells';
import { TruncatedText } from '../logs/TruncatedText';
import { SettingsCard } from '../settings/SettingsParts';

const nf = new Intl.NumberFormat('id-ID');

/** The user's own recent sign-ins so they can spot anything unfamiliar. */
export function LoginHistoryCard({ rows, total }: { rows: LoginRow[]; total: number }) {
  return (
    <SettingsCard
      title="Riwayat masuk"
      description={`${nf.format(total)} kali masuk tercatat. Laporkan ke admin bila ada yang tidak Anda kenali.`}
    >
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          Belum ada riwayat.
        </Text>
      ) : (
        <Stack gap="sm">
          {rows.map((l) => (
            <Group key={l.id} justify="space-between" wrap="nowrap" gap="xs">
              <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                <Tooltip label={formatDateTime(String(l.createdAt))} withArrow openDelay={300}>
                  <Text size="sm" fw={500} lh={1.3}>
                    {formatRelative(String(l.createdAt))}
                  </Text>
                </Tooltip>
                <TruncatedText size="xs" c="dimmed" lh={1.3}>
                  {`${l.ip ?? '—'} · ${countryFlag(l.country)} ${locationLabel(l)} · ${deviceSummary(l)}`}
                </TruncatedText>
              </Stack>
              <Tooltip label={`Metode: ${methodMeta(l.method).label}`} withArrow>
                <div>
                  <MethodBadge method={l.method} size="xs" />
                </div>
              </Tooltip>
            </Group>
          ))}
        </Stack>
      )}
    </SettingsCard>
  );
}

import { Anchor, Avatar, Badge, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import type { DevOverview } from '@server/dev-overview';
import { Link } from 'react-router';
import { methodMeta } from '~/lib/login-logs-api';
import { countryFlag, formatRelative, locationLabel } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';

function Panel({
  title,
  to,
  children,
  empty,
}: {
  title: string;
  to: string;
  children: React.ReactNode[];
  empty: string;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
          {title}
        </Text>
        <Anchor component={Link} to={to} size="xs" prefetch="intent">
          Lihat semua
        </Anchor>
      </Group>
      {children.length === 0 ? (
        <Text size="sm" c="dimmed">
          {empty}
        </Text>
      ) : (
        <Stack gap="xs">{children}</Stack>
      )}
    </Paper>
  );
}

/** Latest logins and latest rate-limit blocks, side by side. */
export function RecentActivity({ data }: { data: DevOverview }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      <Panel title="Login terbaru" to="/dev/login-logs" empty="Belum ada login tercatat.">
        {data.recentLogins.map((l) => (
          <Group key={l.id} gap="sm" wrap="nowrap">
            <Avatar
              src={l.userImage}
              size={26}
              radius="xl"
              name={l.userName ?? undefined}
              color="initials"
              imageProps={{ referrerPolicy: 'no-referrer' }}
            />
            <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
              <TruncatedText size="sm" fw={500} lh={1.3}>
                {l.userName ?? l.userId}
              </TruncatedText>
              <TruncatedText size="xs" c="dimmed" lh={1.3}>
                {`${formatRelative(String(l.createdAt))} · ${countryFlag(l.country)} ${locationLabel(l)} · ${l.ip ?? '—'}`}
              </TruncatedText>
            </Stack>
            <Badge
              size="xs"
              variant="light"
              color={methodMeta(l.method).color}
              style={{ flexShrink: 0 }}
            >
              {methodMeta(l.method).label}
            </Badge>
          </Group>
        ))}
      </Panel>
      <Panel
        title="Blokir rate limit terbaru"
        to="/dev/rate-limit-logs"
        empty="Tidak ada request yang diblokir. Bagus."
      >
        {data.recentBlocks.map((b) => (
          <Group key={b.id} gap="sm" wrap="nowrap">
            <Badge size="xs" variant="light" color="red" ff="monospace" style={{ flexShrink: 0 }}>
              {b.method ?? '—'}
            </Badge>
            <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
              <TruncatedText ff="monospace" size="sm" lh={1.3}>
                {b.path}
              </TruncatedText>
              <TruncatedText size="xs" c="dimmed" lh={1.3}>
                {`${formatRelative(String(b.createdAt))} · ${b.ip ?? '—'} · ${countryFlag(b.country)} ${locationLabel(b)}`}
              </TruncatedText>
            </Stack>
          </Group>
        ))}
      </Panel>
    </SimpleGrid>
  );
}

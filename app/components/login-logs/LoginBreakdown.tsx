import {
  Avatar,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { type LoginStats, methodMeta } from '~/lib/login-logs-api';
import { countryFlag, countryName, deviceLabel, percent } from '~/lib/visits-format';
import { BreakdownPanel } from '../logs/BreakdownPanel';

const nf = new Intl.NumberFormat('id-ID');

type Props = {
  stats: LoginStats;
  onUser: (userId: string) => void;
  onCountry: (code: string) => void;
  onMethod: (method: string) => void;
  onDevice: (type: string) => void;
};

function TopUsers({ stats, onUser }: { stats: LoginStats; onUser: (id: string) => void }) {
  const total = Math.max(1, stats.total);
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} mb="sm">
        User paling sering login
      </Text>
      {stats.topUsers.length === 0 ? (
        <Text size="sm" c="dimmed">
          Belum ada data.
        </Text>
      ) : (
        <Stack gap="xs">
          {stats.topUsers.map((u) => {
            const pct = percent(u.count, total);
            return (
              <UnstyledButton
                key={u.userId}
                onClick={() => onUser(u.userId)}
                aria-label={`Filter user ${u.name ?? u.userId}`}
              >
                <Stack gap={4}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Avatar src={u.image} size={20} radius="xl">
                        {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                      </Avatar>
                      <Text size="sm" truncate style={{ minWidth: 0 }}>
                        {u.name ?? u.userId}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {nf.format(u.count)} · {pct}%
                    </Text>
                  </Group>
                  <Progress value={pct} size="xs" radius="xl" />
                </Stack>
              </UnstyledButton>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

/** Top-N panels; user, country, method and device rows apply the matching filter on click. */
export function LoginBreakdown({ stats, onUser, onCountry, onMethod, onDevice }: Props) {
  const total = Math.max(1, stats.total);
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="sm">
      <TopUsers stats={stats} onUser={onUser} />
      <BreakdownPanel
        title="Metode login"
        items={stats.topMethods}
        total={total}
        render={(k) => methodMeta(k).label}
        onSelect={onMethod}
      />
      <BreakdownPanel
        title="Negara"
        items={stats.topCountries}
        total={total}
        render={(k) => `${countryFlag(k)} ${countryName(k)}`.trim()}
        onSelect={onCountry}
        emptyText="Belum ada data negara. Aktifkan header geo dari proxy (Cloudflare/Vercel/nginx)."
      />
      <BreakdownPanel
        title="Perangkat"
        items={stats.devices}
        total={total}
        render={(k) => deviceLabel(k)}
        onSelect={onDevice}
      />
      <BreakdownPanel
        title="Browser"
        items={stats.topBrowsers}
        total={total}
        render={(k) => k ?? 'Tidak dikenali'}
      />
      <BreakdownPanel
        title="Sistem operasi"
        items={stats.topOs}
        total={total}
        render={(k) => k ?? 'Tidak dikenali'}
      />
    </SimpleGrid>
  );
}

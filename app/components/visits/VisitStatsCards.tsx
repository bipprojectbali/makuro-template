import { Group, Paper, SimpleGrid, Skeleton, Text, ThemeIcon } from '@mantine/core';
import type { IconType } from 'react-icons';
import { FiActivity, FiClock, FiCpu, FiGlobe, FiUser, FiUsers } from 'react-icons/fi';
import type { VisitStats } from '~/lib/visits-api';
import { percent } from '~/lib/visits-format';

const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

type Tile = { label: string; value: number; hint?: string; icon: IconType; color?: string };

const nf = new Intl.NumberFormat('id-ID');

function StatTile({ label, value, hint, icon: Icon, color = 'blue' }: Tile) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} truncate>
            {label}
          </Text>
          <Text fz={26} fw={700} lh={1.2} mt={4}>
            {nf.format(value)}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" mt={2} truncate>
              {hint}
            </Text>
          )}
        </div>
        <ThemeIcon variant="light" color={color} size="lg" radius="md" style={{ flexShrink: 0 }}>
          <Icon size={16} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

/** KPI row for the visitor console: totals, uniqueness, recency, and human/bot split. */
export function VisitStatsCards({ stats }: { stats: VisitStats | undefined }) {
  if (!stats) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
        {SKELETON_KEYS.map((k) => (
          <Skeleton key={k} h={92} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  const tiles: Tile[] = [
    { label: 'Total kunjungan', value: stats.total, hint: 'semua waktu', icon: FiActivity },
    {
      label: 'Pengunjung unik',
      value: stats.uniqueIps,
      hint: 'berdasarkan IP',
      icon: FiGlobe,
      color: 'indigo',
    },
    {
      label: '24 jam terakhir',
      value: stats.last24h,
      hint: `${nf.format(stats.last7d)} dalam 7 hari`,
      icon: FiClock,
      color: 'cyan',
    },
    {
      label: 'Human',
      value: stats.humans,
      hint: `${percent(stats.humans, stats.total)}% dari total`,
      icon: FiUsers,
      color: 'teal',
    },
    {
      label: 'Bot',
      value: stats.bots,
      hint: `${percent(stats.bots, stats.total)}% dari total`,
      icon: FiCpu,
      color: 'red',
    },
    {
      label: 'Login',
      value: stats.loggedIn,
      hint: 'kunjungan user terautentikasi',
      icon: FiUser,
      color: 'grape',
    },
  ];

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </SimpleGrid>
  );
}

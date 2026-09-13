import { Group, Paper, SimpleGrid, Skeleton, Text, ThemeIcon } from '@mantine/core';
import type { IconType } from 'react-icons';
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiCheckCircle,
  FiCpu,
  FiFileText,
  FiZap,
} from 'react-icons/fi';
import { type FileHealthSummary, fmtNum, fmtTokens } from '~/lib/file-health-api';

type Tile = { label: string; value: string; hint: string; icon: IconType; color: string };

const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5'];

/** KPI row: scan size, limit violations, and agent-context hazards. */
export function FileHealthStats({ summary }: { summary: FileHealthSummary | undefined }) {
  if (!summary) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
        {SKELETON_KEYS.map((k) => (
          <Skeleton key={k} h={92} radius="md" />
        ))}
      </SimpleGrid>
    );
  }
  const checked = summary.scanned - summary.excluded;
  const tiles: Tile[] = [
    {
      label: 'File dipindai',
      value: fmtNum(summary.scanned),
      hint: `${fmtNum(summary.excluded)} dikecualikan`,
      icon: FiFileText,
      color: 'blue',
    },
    {
      label: 'Sehat',
      value: fmtNum(summary.ok),
      hint: `dari ${fmtNum(checked)} file diperiksa`,
      icon: FiCheckCircle,
      color: 'teal',
    },
    {
      label: 'Hampir batas',
      value: fmtNum(summary.warn),
      hint: '≥ 80% dari limit baris',
      icon: FiAlertTriangle,
      color: 'yellow',
    },
    {
      label: 'Lewat batas',
      value: fmtNum(summary.over),
      hint: `${fmtNum(summary.hardViolations)} melanggar hard limit`,
      icon: FiAlertOctagon,
      color: 'red',
    },
    {
      label: 'Bahaya konteks',
      value: fmtNum(summary.danger + summary.caution),
      hint: `${fmtNum(summary.danger)} bahaya · ${fmtNum(summary.caution)} hati-hati`,
      icon: FiCpu,
      color: 'orange',
    },
    {
      label: 'Estimasi token',
      value: fmtTokens(summary.totalTokens),
      hint: 'seluruh repo bila dibaca utuh',
      icon: FiZap,
      color: 'grape',
    },
  ];
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
      {tiles.map((t) => (
        <Paper key={t.label} withBorder radius="md" p="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <div style={{ minWidth: 0 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} truncate>
                {t.label}
              </Text>
              <Text fz={26} fw={700} lh={1.2} mt={4}>
                {t.value}
              </Text>
              <Text size="xs" c="dimmed" mt={2} truncate>
                {t.hint}
              </Text>
            </div>
            <ThemeIcon
              variant="light"
              color={t.color}
              size="lg"
              radius="md"
              style={{ flexShrink: 0 }}
            >
              <t.icon size={16} />
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

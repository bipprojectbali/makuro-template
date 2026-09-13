import { Alert, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { FiCpu } from 'react-icons/fi';
import { type FileHealthRow, fmtNum, HAZARD_META } from '~/lib/file-health-api';

type Props = { rows: FileHealthRow[]; cautionTokens: number; dangerTokens: number };

/**
 * Files that would eat a large slice of an AI agent's context window if read
 * whole. Shown above the table so it is the first thing an operator sees.
 */
export function FileHealthHazards({ rows, cautionTokens, dangerTokens }: Props) {
  const hazards = rows.filter((r) => r.hazard !== 'none').sort((a, b) => b.estTokens - a.estTokens);
  if (hazards.length === 0) {
    return (
      <Alert
        color="teal"
        variant="light"
        icon={<FiCpu size={16} />}
        title="Tidak ada file berisiko untuk konteks agent"
      >
        Semua file di bawah {fmtNum(cautionTokens)} token estimasi. Agent aman membaca file mana pun
        secara utuh.
      </Alert>
    );
  }
  return (
    <Alert
      color="orange"
      variant="light"
      icon={<FiCpu size={16} />}
      title={`${fmtNum(hazards.length)} file berisiko meledakkan konteks agent`}
    >
      <Text size="sm" mb="sm">
        Estimasi ≥ {fmtNum(cautionTokens)} token = hati-hati, ≥ {fmtNum(dangerTokens)} token =
        bahaya (≈ 4 karakter per token). Agent sebaiknya memakai grep atau membaca rentang baris,
        bukan seluruh file. Tool MCP <code>check_file_health</code> memberi saran yang sama sebelum
        file dibaca.
      </Text>
      <Stack gap="xs">
        {hazards.map((r) => (
          <Paper key={r.path} withBorder radius="sm" p="xs">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <Badge
                  color={HAZARD_META[r.hazard].color}
                  size="sm"
                  variant="filled"
                  style={{ flexShrink: 0 }}
                >
                  {HAZARD_META[r.hazard].label}
                </Badge>
                <Text ff="monospace" size="sm" truncate style={{ minWidth: 0 }}>
                  {r.path}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                ~{fmtNum(r.estTokens)} token · {fmtNum(r.lines)} baris
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {r.advice}
            </Text>
          </Paper>
        ))}
      </Stack>
    </Alert>
  );
}

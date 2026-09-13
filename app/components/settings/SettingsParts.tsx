import { Badge, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core';

/** Card wrapper for one settings group, with a title row that can hold status badges/actions. */
export function SettingsCard({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper withBorder radius="md" p={{ base: 'md', md: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <div>
            <Title order={5}>{title}</Title>
            {description && (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            )}
          </div>
          {aside}
        </Group>
        <Divider />
        {children}
      </Stack>
    </Paper>
  );
}

/** Label + description on the left, control on the right; stacks on narrow screens. */
export function SettingRow({
  label,
  description,
  badge,
  control,
}: {
  label: string;
  description: string;
  badge?: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
      <Stack gap={2} style={{ flex: '1 1 260px', minWidth: 0 }}>
        <Group gap="xs" wrap="wrap">
          <Text fw={500}>{label}</Text>
          {badge}
        </Group>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Stack>
      <div style={{ flex: '0 1 auto' }}>{control}</div>
    </Group>
  );
}

/** "Default" / "Diubah" marker next to a field. */
export function OverrideBadge({ overridden }: { overridden: boolean }) {
  return (
    <Badge size="xs" variant="light" color={overridden ? 'blue' : 'gray'}>
      {overridden ? 'Diubah' : 'Default'}
    </Badge>
  );
}

import { Avatar, Badge, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';
import type { AppUser } from '~/lib/app-context';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';

const ROLE_COLOR: Record<string, string> = { user: 'gray', admin: 'blue', 'super-admin': 'grape' };

/** Identity strip: avatar, name, email + verification, role, membership age. */
export function ProfileHeader({ user, role }: { user: AppUser; role: string }) {
  const verified = Boolean(user.emailVerified);
  return (
    <Paper withBorder radius="md" p={{ base: 'md', md: 'lg' }}>
      <Group wrap="nowrap" align="flex-start" gap="md">
        <Avatar
          src={user.image}
          radius="xl"
          size={72}
          name={user.name}
          color="initials"
          imageProps={{ referrerPolicy: 'no-referrer' }}
        />
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <TruncatedText fw={700} size="xl" lh={1.2}>
            {user.name}
          </TruncatedText>
          <Group gap="xs" wrap="nowrap">
            <TruncatedText size="sm" c="dimmed">
              {user.email}
            </TruncatedText>
            {verified ? (
              <Badge
                size="xs"
                variant="light"
                color="teal"
                leftSection={<FiCheckCircle size={11} />}
                style={{ flexShrink: 0 }}
              >
                Terverifikasi
              </Badge>
            ) : (
              <Tooltip label="Email belum diverifikasi. Beberapa fitur mungkin dibatasi." withArrow>
                <Badge
                  size="xs"
                  variant="light"
                  color="yellow"
                  leftSection={<FiXCircle size={11} />}
                  style={{ flexShrink: 0 }}
                >
                  Belum verifikasi
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light" color={ROLE_COLOR[role] ?? 'gray'}>
              {role}
            </Badge>
            <Tooltip label={formatDateTime(String(user.createdAt))} withArrow>
              <Text size="xs" c="dimmed">
                Bergabung {formatRelative(String(user.createdAt))}
              </Text>
            </Tooltip>
          </Group>
        </Stack>
      </Group>
    </Paper>
  );
}

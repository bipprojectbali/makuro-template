import { Avatar, Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import { FiCalendar, FiCheckCircle, FiMail, FiXCircle } from 'react-icons/fi';
import { useApp } from '~/lib/app-context';
import { useSession } from '~/lib/auth-client';
import type { Route } from './+types/profile';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Profile — Makuro' }];
}

export default function Profile() {
  const { user: ctxUser, role } = useApp();
  const { data } = useSession();
  const user = data?.user ?? ctxUser;
  const verified = Boolean(user.emailVerified);

  return (
    <Stack maw={520}>
      <Title order={2}>Profile</Title>
      <Card withBorder radius="md" padding="lg">
        <Group wrap="nowrap" mb="md">
          <Avatar
            src={user.image}
            radius="xl"
            size={64}
            name={user.name}
            color="initials"
            imageProps={{ referrerPolicy: 'no-referrer' }}
          />
          <div style={{ minWidth: 0 }}>
            <Text fw={600} size="lg" truncate>
              {user.name}
            </Text>
            <Badge variant="light" color="gray" mt={4}>
              {role}
            </Badge>
          </div>
        </Group>

        <Stack gap="xs">
          <Group gap="xs" wrap="nowrap">
            <FiMail size={16} />
            <Text size="sm">{user.email}</Text>
            {verified ? (
              <Badge
                size="xs"
                variant="light"
                color="green"
                leftSection={<FiCheckCircle size={12} />}
              >
                verified
              </Badge>
            ) : (
              <Badge size="xs" variant="light" color="yellow" leftSection={<FiXCircle size={12} />}>
                unverified
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <FiCalendar size={16} />
            <Text size="sm" c="dimmed">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

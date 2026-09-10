import { Anchor, Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { FiGithub, FiGrid, FiLogIn } from 'react-icons/fi';
import { Link } from 'react-router';
import { client } from '~/lib/eden';
import type { Route } from './+types/home';

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Makuro \u2014 Fullstack Template' },
    { name: 'description', content: 'Bun + Elysia + React Router + Drizzle + Better Auth' },
  ];
}

export default function Home() {
  const hello = useQuery({
    queryKey: ['hello'],
    queryFn: async () => {
      const { data, error } = await client.api.hello.get();
      if (error) throw error;
      return data;
    },
  });

  const stack = [
    'Bun',
    'Elysia',
    'Eden',
    'React Router v8',
    'Drizzle',
    'PostgreSQL',
    'Better Auth',
    'Mantine',
    'TanStack Query',
    'Zustand',
    'TypeBox',
    'Zod',
    'Biome',
    'Pino',
  ];

  return (
    <Container size="sm" py={64}>
      <Stack gap="lg">
        <Title order={1}>Makuro ⚡</Title>
        <Text c="dimmed">Fullstack base template — frontend & backend on a single origin.</Text>

        <Card withBorder radius="md" padding="lg">
          <Text fw={600} mb="xs">
            API check (TanStack Query + Eden Treaty)
          </Text>
          {hello.isLoading && <Text size="sm">Loading…</Text>}
          {hello.isError && (
            <Text size="sm" c="red">
              Failed to reach /api/hello
            </Text>
          )}
          {hello.data && (
            <Text size="sm" c="green">
              {hello.data.message} — {new Date(hello.data.time).toLocaleTimeString()}
            </Text>
          )}
        </Card>

        <Group gap="xs">
          {stack.map((s) => (
            <Badge key={s} variant="light">
              {s}
            </Badge>
          ))}
        </Group>

        <Group>
          <Button component={Link} to="/login" leftSection={<FiLogIn size={16} />}>
            Login / Sign up
          </Button>
          <Button component={Link} to="/go" variant="default" leftSection={<FiGrid size={16} />}>
            Open app
          </Button>
        </Group>

        <Anchor
          href="https://github.com/SaltyAom/elysia-fullstack-example"
          size="sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <FiGithub size={14} />
          Reference: Elysia fullstack example
        </Anchor>
      </Stack>
    </Container>
  );
}

import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { auth } from '@server/auth';
import { redirect, useNavigate } from 'react-router';
import { signOut, useSession } from '~/lib/auth-client';
import type { Route } from './+types/dashboard';

/**
 * SSR loader: check the session on the server via Better Auth. If not logged
 * in, redirect to /login before rendering (no client flash).
 */
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect('/login');
  return { user: session.user };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { data } = useSession();
  const user = data?.user ?? loaderData.user;

  return (
    <Container size="sm" py={64}>
      <Stack>
        <Title order={2}>Dashboard</Title>
        <Text>
          Signed in as <b>{user.email}</b>
        </Text>
        <Group>
          <Button
            variant="default"
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
          >
            Sign out
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}

import {
  Button,
  Container,
  Divider,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { hasLength, isEmail, isNotEmpty, useForm } from '@mantine/form';
import { hasGoogleAuth } from '@server/env';
import { getSettings } from '@server/settings';
import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useNavigate } from 'react-router';
import { signIn, signUp } from '~/lib/auth-client';
import type { Route } from './+types/login';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Sign in — Makuro' }];
}

export async function loader() {
  const { emailAuthEnabled, signupEnabled } = await getSettings();
  return { googleEnabled: hasGoogleAuth, emailAuthEnabled, signupEnabled };
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { googleEnabled, emailAuthEnabled, signupEnabled } = loaderData;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (value) => (mode === 'signup' ? isNotEmpty('Name is required')(value) : null),
      email: isEmail('Invalid email'),
      password: hasLength({ min: 8 }, 'Min 8 characters'),
    },
  });

  const submit = form.onSubmit(async (values) => {
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'signup'
          ? await signUp.email({
              name: values.name || values.email,
              email: values.email,
              password: values.password,
            })
          : await signIn.email({ email: values.email, password: values.password });
      if (res.error) {
        setError(res.error.message ?? 'Authentication failed');
        return;
      }
      // /go resolves the role server-side and lands on the right area.
      navigate('/go');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  });

  async function continueWithGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      // Redirects to Google, then to /go which routes to the role's home.
      await signIn.social({ provider: 'google', callbackURL: '/go' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setGoogleLoading(false);
    }
  }

  return (
    <Container size="xs" py={64}>
      <Title order={2} mb="lg" ta="center">
        Welcome to Makuro
      </Title>

      {emailAuthEnabled && signupEnabled && (
        <SegmentedControl
          fullWidth
          mb="md"
          value={mode}
          onChange={(v) => setMode(v as 'signin' | 'signup')}
          data={[
            { label: 'Sign in', value: 'signin' },
            { label: 'Sign up', value: 'signup' },
          ]}
        />
      )}

      <Paper withBorder p="lg" shadow="sm">
        <Stack>
          {googleEnabled && (
            <>
              <Button
                variant="default"
                fullWidth
                leftSection={<FcGoogle size={18} />}
                loading={googleLoading}
                onClick={continueWithGoogle}
              >
                Continue with Google
              </Button>
              {emailAuthEnabled && <Divider label="or" labelPosition="center" />}
            </>
          )}

          {emailAuthEnabled && (
            <form onSubmit={submit}>
              <Stack>
                {mode === 'signup' && signupEnabled && (
                  <TextInput
                    label="Name"
                    placeholder="Your name"
                    key={form.key('name')}
                    {...form.getInputProps('name')}
                  />
                )}
                <TextInput
                  label="Email"
                  placeholder="you@example.com"
                  key={form.key('email')}
                  {...form.getInputProps('email')}
                />
                <PasswordInput
                  label="Password"
                  placeholder="At least 8 characters"
                  key={form.key('password')}
                  {...form.getInputProps('password')}
                />
                {error && (
                  <Text c="red" size="sm">
                    {error}
                  </Text>
                )}
                <Button type="submit" loading={loading} fullWidth>
                  {mode === 'signup' && signupEnabled ? 'Create account' : 'Sign in'}
                </Button>
              </Stack>
            </form>
          )}

          {!googleEnabled && !emailAuthEnabled && (
            <Text c="dimmed" size="sm" ta="center">
              Login tidak tersedia. Hubungi administrator.
            </Text>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}

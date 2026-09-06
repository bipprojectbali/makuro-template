import {
  Button,
  Container,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signIn, signUp } from '~/lib/auth-client';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Min 8 characters'),
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
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Container size="xs" py={64}>
      <Title order={2} mb="lg">
        Welcome
      </Title>
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
      <Paper withBorder radius="md" p="lg">
        <form onSubmit={submit}>
          <Stack>
            {mode === 'signup' && (
              <TextInput label="Name" placeholder="Your name" {...form.getInputProps('name')} />
            )}
            <TextInput
              label="Email"
              placeholder="you@example.com"
              {...form.getInputProps('email')}
            />
            <PasswordInput label="Password" {...form.getInputProps('password')} />
            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
            <Button type="submit" loading={loading}>
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

import {
  Anchor,
  Button,
  Divider,
  Group,
  Image,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { hasLength, isEmail, isNotEmpty, useForm } from '@mantine/form';
import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useNavigate, useSearchParams } from 'react-router';
import { DemoLoginOption } from '~/components/login/DemoStartButton';
import { LoginNotice } from '~/components/login/LoginNotices';
import { signIn, signUp } from '~/lib/auth-client';
import { type AuthNotice, describeAuthError, loginNotice } from '~/lib/auth-errors';
import { googleNote, initialMode, type LoginMode, modeCopy } from '~/lib/login-mode';

const MIN_PASSWORD = 8;
const FIELD = { variant: 'filled', size: 'md', radius: 'md' } as const;

type Props = {
  appName: string;
  supportUrl: string | null;
  googleEnabled: boolean;
  emailAuthEnabled: boolean;
  signupEnabled: boolean;
  demoTtlHours: number | null;
  demoRoles: string[] | null;
};

/** Left column of the login card: brand, email/password form, Google, demo, mode toggle. */
export function LoginForm({
  appName,
  supportUrl,
  googleEnabled,
  emailAuthEnabled,
  signupEnabled,
  demoTtlHours,
  demoRoles,
}: Props) {
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(() => initialMode(searchParams, signupEnabled));
  // Starts from the URL (guard redirect, OAuth callback), replaced by form results.
  const [notice, setNotice] = useState<AuthNotice | null>(() => loginNotice(searchParams));
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const signup = mode === 'signup' && signupEnabled;
  const copy = modeCopy(signup ? 'signup' : 'signin', appName);
  const note = googleNote(signupEnabled);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (value) => (mode === 'signup' ? isNotEmpty('Nama wajib diisi')(value) : null),
      email: isEmail('Email tidak valid'),
      password: hasLength({ min: MIN_PASSWORD }, `Minimal ${MIN_PASSWORD} karakter`),
    },
  });

  const submit = form.onSubmit(async (values) => {
    setNotice(null);
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
        setNotice(describeAuthError(res.error));
        return;
      }
      // /go resolves the role server-side and lands on the right area.
      navigate('/go');
    } catch (err) {
      setNotice(describeAuthError({ message: err instanceof Error ? err.message : null }));
    } finally {
      setLoading(false);
    }
  });

  async function continueWithGoogle() {
    setNotice(null);
    setGoogleLoading(true);
    try {
      // Success → /go (role-aware home). Failure (e.g. banned) → back here with ?error=<code>.
      await signIn.social({ provider: 'google', callbackURL: '/go', errorCallbackURL: '/login' });
    } catch (err) {
      setNotice(describeAuthError({ message: err instanceof Error ? err.message : null }));
      setGoogleLoading(false);
    }
  }

  const banned = notice?.kind === 'banned';

  return (
    <Stack gap="lg">
      <Group gap="xs">
        <Image src="/favicon.svg" alt="" w={28} h={28} />
        <Text fw={700}>{appName}</Text>
      </Group>

      <Stack gap={4}>
        <Title order={2}>{copy.title}</Title>
        <Text c="dimmed" size="sm">
          {copy.subtitle}
        </Text>
      </Stack>

      <LoginNotice notice={notice} supportUrl={supportUrl} />

      {emailAuthEnabled && (
        <form onSubmit={submit}>
          <Stack>
            {signup && (
              <TextInput
                label="Nama"
                placeholder="Nama Anda"
                {...FIELD}
                autoComplete="name"
                key={form.key('name')}
                {...form.getInputProps('name')}
              />
            )}
            <TextInput
              label="Email"
              placeholder="anda@contoh.com"
              {...FIELD}
              inputMode="email"
              autoComplete="email"
              key={form.key('email')}
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Kata sandi"
              placeholder={`Minimal ${MIN_PASSWORD} karakter`}
              {...FIELD}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              key={form.key('password')}
              {...form.getInputProps('password')}
            />
            <Button
              type="submit"
              loading={loading}
              fullWidth
              size="md"
              radius="md"
              color={`${theme.primaryColor}.8`}
            >
              {copy.submit}
            </Button>
          </Stack>
        </form>
      )}

      {googleEnabled && (
        <Stack gap="lg">
          {emailAuthEnabled && <Divider label="atau" labelPosition="center" />}
          <Button
            variant="default"
            fullWidth
            size="md"
            radius="md"
            leftSection={<FcGoogle size={18} />}
            loading={googleLoading}
            disabled={banned}
            onClick={continueWithGoogle}
          >
            Lanjutkan dengan Google
          </Button>
          {note && (
            <Text size="xs" c="dimmed" ta="center">
              {note}
            </Text>
          )}
        </Stack>
      )}

      {demoTtlHours !== null && demoRoles !== null && (
        <DemoLoginOption ttlHours={demoTtlHours} roles={demoRoles} />
      )}

      {!googleEnabled && !emailAuthEnabled && (
        <Text c="dimmed" size="sm" ta="center">
          Login tidak tersedia. Hubungi administrator.
        </Text>
      )}

      {emailAuthEnabled && signupEnabled && (
        <Text size="sm" c="dimmed" ta="center">
          {copy.switchPrompt}{' '}
          <Anchor
            component="button"
            type="button"
            size="sm"
            fw={600}
            onClick={() => setMode(signup ? 'signin' : 'signup')}
          >
            {copy.switchAction}
          </Anchor>
        </Text>
      )}
    </Stack>
  );
}

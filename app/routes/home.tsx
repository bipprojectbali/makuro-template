import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  FiCode,
  FiDatabase,
  FiExternalLink,
  FiGithub,
  FiGrid,
  FiLayers,
  FiLogIn,
  FiPackage,
  FiShield,
  FiTerminal,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { Link } from 'react-router';
import type { Route } from './+types/home';

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Makuro — Fullstack Template' },
    {
      name: 'description',
      content:
        'Bun + Elysia + React Router v8 SSR + Drizzle + Better Auth. Satu port, tanpa CORS, siap production.',
    },
  ];
}

const GITHUB_URL = 'https://github.com/bipprojectbali/makuro-template';

const FEATURES = [
  {
    icon: FiLayers,
    color: 'blue',
    title: 'Single-port architecture',
    desc: 'API dan SSR frontend berjalan di satu Elysia server — tanpa reverse proxy, tanpa CORS config. Struktur dev dan prod identik.',
  },
  {
    icon: FiCode,
    color: 'violet',
    title: 'End-to-end type safety',
    desc: 'Eden Treaty mengekstrak tipe client langsung dari definisi route Elysia. Tanpa codegen, tanpa type drift antara server dan client.',
  },
  {
    icon: FiShield,
    color: 'teal',
    title: 'Auth siap pakai',
    desc: 'Better Auth: Google OAuth, email + password, multi-session, dan sistem role (user / admin / super-admin). Session divalidasi server-side di loader.',
  },
  {
    icon: FiZap,
    color: 'yellow',
    title: 'SSR tanpa trade-off',
    desc: 'React Router v8 loader berjalan server-side dengan akses session penuh. Halaman protected tidak pernah flash — satu HTTP response, tanpa auth waterfall.',
  },
  {
    icon: FiDatabase,
    color: 'orange',
    title: 'DB layer type-safe',
    desc: 'Drizzle ORM + PostgreSQL. Schema-as-code, file migrasi, dan Drizzle Studio. Schema adalah satu-satunya sumber kebenaran.',
  },
  {
    icon: FiGrid,
    color: 'pink',
    title: 'UI kit production-ready',
    desc: 'Mantine v9 untuk komponen dan theming, TanStack Query untuk data fetching, Zustand untuk client state, Biome untuk linting. Semua sudah terkonfigurasi.',
  },
  {
    icon: FiPackage,
    color: 'cyan',
    title: 'Deploy satu binary',
    desc: 'Build ke binary native yang embed Bun runtime, SSR bundle, dan semua static assets. Copy satu file ke server, langsung jalan — tanpa Node, tanpa Bun, tanpa npm install.',
  },
  {
    icon: FiUsers,
    color: 'indigo',
    title: 'Admin console built-in',
    desc: 'Area role-based yang siap pakai: user, admin, dan super-admin masing-masing punya layout dan route terpisah. Manajemen user, ban, role change, dan app settings sudah tersedia.',
  },
];

const STACK = [
  { label: 'Bun 1.4', color: 'orange' },
  { label: 'Elysia 1.4', color: 'violet' },
  { label: 'React 19', color: 'cyan' },
  { label: 'React Router v8 SSR', color: 'blue' },
  { label: 'Drizzle ORM 0.45', color: 'green' },
  { label: 'PostgreSQL 16', color: 'blue' },
  { label: 'Better Auth 1.7', color: 'teal' },
  { label: 'Mantine v9', color: 'indigo' },
  { label: 'TanStack Query 5', color: 'red' },
  { label: 'Zustand 5', color: 'orange' },
  { label: 'TypeScript 7', color: 'blue' },
  { label: 'Biome 2.5', color: 'green' },
  { label: 'Vite 8', color: 'violet' },
  { label: 'Pino 10', color: 'gray' },
];

const ARCH = `Browser
  │
  ▼ HTTP :3005
┌──────────────────────────────────────────────┐
│             Bun / Node  (1 proses)           │
│                                              │
│  /api/auth/*  →  Better Auth                 │
│  /api/*       →  Elysia API  ↔  Eden Treaty  │
│  /assets/*    →  Vite static (immutable)     │
│  /*           →  React Router SSR            │
└──────────────────────────────────────────────┘`;

const QUICK_START = `# 1. Install
bun install

# 2. Konfigurasi env
cp .env.example .env
# Wajib: DATABASE_URL, BETTER_AUTH_SECRET
# Opsional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 3. Migrasi database
bun run db:migrate

# 4. Jalankan dev server
bun run dev   # → http://localhost:3005`;

export default function Home() {
  return (
    <Box>
      {/* ── Hero ──────────────────────────────────────── */}
      <Box
        style={(theme) => ({
          background: `linear-gradient(145deg, ${theme.colors.blue[9]} 0%, ${theme.colors.violet[8]} 100%)`,
          padding: '88px 0 72px',
        })}
      >
        <Container size="lg">
          <Stack gap="xl" align="center" ta="center">
            <Group gap="sm" align="center">
              <img
                src="/favicon.svg"
                alt="Makuro logo"
                width={48}
                height={48}
                style={{ borderRadius: 10 }}
              />
              <Title
                order={1}
                style={{
                  color: 'white',
                  fontSize: 'clamp(2rem, 6vw, 3.75rem)',
                  letterSpacing: -1,
                }}
              >
                Makuro
              </Title>
            </Group>

            <Title
              order={2}
              style={{
                color: 'rgba(255,255,255,0.88)',
                fontWeight: 500,
                fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
                maxWidth: 600,
              }}
            >
              Fullstack template. Satu port, tanpa CORS, siap production.
            </Title>

            <Text
              size="md"
              style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 520, lineHeight: 1.75 }}
            >
              Bun + Elysia + React Router v8 (SSR) + Drizzle + Better Auth — sudah terhubung dan
              diverifikasi end-to-end. Clone, set env, jalankan.
            </Text>

            <Group gap="md" wrap="wrap" justify="center">
              <Button
                component={Link}
                to="/login"
                size="lg"
                variant="white"
                color="blue"
                leftSection={<FiLogIn size={18} />}
              >
                Buka app
              </Button>
              <Button
                component="a"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                variant="outline"
                style={{ borderColor: 'rgba(255,255,255,0.45)', color: 'white' }}
                leftSection={<FiGithub size={18} />}
              >
                GitHub
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* ── Stats strip ───────────────────────────────── */}
      <Box py="lg" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Container size="lg">
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {[
              { value: '1', label: 'Port untuk segalanya' },
              { value: '0', label: 'CORS config diperlukan' },
              { value: '1 file', label: 'Deploy ke server manapun' },
              { value: '100%', label: 'TypeScript server ke client' },
            ].map((s) => (
              <Stack key={s.label} gap={2} align="center" ta="center" py="sm">
                <Text fw={700} size="xl" c="blue">
                  {s.value}
                </Text>
                <Text size="xs" c="dimmed">
                  {s.label}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── Features ──────────────────────────────────── */}
      <Container size="lg" py={80}>
        <Stack gap="xl">
          <Stack gap="xs" ta="center">
            <Title order={2}>Apa yang sudah ada di dalamnya</Title>
            <Text c="dimmed" maw={500} mx="auto" size="sm">
              Bukan boilerplate yang butuh banyak konfigurasi — semua bagian ini sudah terhubung
              dan berjalan bersama.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
            {FEATURES.map((f) => (
              <Card key={f.title} withBorder padding="lg" style={{ height: '100%' }}>
                <ThemeIcon size={44} radius="md" variant="light" color={f.color} mb="md">
                  <f.icon size={22} />
                </ThemeIcon>
                <Text fw={600} mb={6} size="sm">
                  {f.title}
                </Text>
                <Text size="sm" c="dimmed" lh={1.65}>
                  {f.desc}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>

      <Divider />

      {/* ── Architecture ──────────────────────────────── */}
      <Container size="md" py={80}>
        <Stack gap="xl">
          <Stack gap="xs" ta="center">
            <Title order={2}>Bagaimana single-port bekerja</Title>
            <Text c="dimmed" size="sm">
              Satu proses menangani API, auth, SSR, dan static assets — pola yang sama di dev dan
              prod.
            </Text>
          </Stack>

          <Box
            style={{
              background: 'var(--mantine-color-dark-8)',
              borderRadius: 12,
              overflow: 'auto',
              border: '1px solid var(--mantine-color-dark-5)',
            }}
          >
            <Box
              px="md"
              py={10}
              style={{
                borderBottom: '1px solid var(--mantine-color-dark-6)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FiTerminal size={13} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed" ff="monospace">
                architecture
              </Text>
            </Box>
            <Box p="lg">
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'ui-monospace, Consolas, "Courier New", monospace',
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: 'var(--mantine-color-gray-3)',
                  whiteSpace: 'pre',
                }}
              >
                {ARCH}
              </pre>
            </Box>
          </Box>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Card withBorder padding="md">
              <Text fw={600} size="sm" mb={6}>
                Dev mode
              </Text>
              <Text size="sm" c="dimmed" lh={1.65}>
                Vite middleware berjalan di dalam server yang sama. HMR aktif di port yang sama —
                tidak ada Vite server terpisah, tidak ada konflik port.
              </Text>
            </Card>
            <Card withBorder padding="md">
              <Text fw={600} size="sm" mb={6}>
                Production
              </Text>
              <Text size="sm" c="dimmed" lh={1.65}>
                <code>Bun.serve</code> dengan static assets berhash (immutable cache) dan bundle
                React Router SSR yang sudah dikompilasi. Satu proses, satu port.
              </Text>
            </Card>
          </SimpleGrid>
        </Stack>
      </Container>

      <Divider />

      {/* ── Stack ─────────────────────────────────────── */}
      <Container size="lg" py={80}>
        <Stack gap="xl">
          <Stack gap="xs" ta="center">
            <Title order={2}>Tech stack</Title>
            <Text c="dimmed" size="sm">
              Versi spesifik yang sudah diuji dan berjalan bersama di 2026.
            </Text>
          </Stack>

          <Group justify="center" gap="sm" style={{ flexWrap: 'wrap' }}>
            {STACK.map((s) => (
              <Badge key={s.label} variant="light" color={s.color} size="lg" radius="sm">
                {s.label}
              </Badge>
            ))}
          </Group>
        </Stack>
      </Container>

      <Divider />

      {/* ── Quick Start ───────────────────────────────── */}
      <Container size="md" py={80}>
        <Stack gap="xl">
          <Stack gap="xs" ta="center">
            <Title order={2}>Quick start</Title>
            <Text c="dimmed" size="sm">
              Empat langkah dari nol ke dev server.
            </Text>
          </Stack>

          <Box
            style={{
              background: 'var(--mantine-color-dark-8)',
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid var(--mantine-color-dark-5)',
            }}
          >
            <Box
              px="md"
              py={10}
              style={{
                borderBottom: '1px solid var(--mantine-color-dark-6)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FiTerminal size={13} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed" ff="monospace">
                bash
              </Text>
            </Box>
            <Box p="lg">
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'ui-monospace, Consolas, "Courier New", monospace',
                  fontSize: 13,
                  lineHeight: 1.85,
                  color: 'var(--mantine-color-gray-3)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {QUICK_START}
              </pre>
            </Box>
          </Box>

          <Group justify="center" gap="md">
            <Button component={Link} to="/login" size="md" leftSection={<FiLogIn size={16} />}>
              Buka app
            </Button>
            <Button
              component="a"
              href="/api/hello"
              variant="default"
              size="md"
              leftSection={<FiExternalLink size={16} />}
            >
              Cek API
            </Button>
          </Group>
        </Stack>
      </Container>

      {/* ── Footer ────────────────────────────────────── */}
      <Box py="lg" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
        <Container size="lg">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="xs" align="center">
              <img
                src="/favicon.svg"
                alt="Makuro"
                width={20}
                height={20}
                style={{ borderRadius: 4 }}
              />
              <Text size="sm" c="dimmed">
                Makuro — MIT License
              </Text>
            </Group>
            <Group gap="md">
              <Anchor
                href={GITHUB_URL}
                size="sm"
                c="dimmed"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </Anchor>
              <Anchor href="/api/hello" size="sm" c="dimmed">
                API
              </Anchor>
              <Anchor component={Link} to="/login" size="sm" c="dimmed">
                Login
              </Anchor>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}

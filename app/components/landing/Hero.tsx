import {
  Badge,
  Box,
  Button,
  Code,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { FiArrowRight, FiCheck, FiGithub } from 'react-icons/fi';
import { Link } from 'react-router';
import { GITHUB_URL } from './landing.content';

export type LandingStats = {
  tables: number;
  consolePages: number;
  mcpTools: number;
  testFiles: number;
  version: string;
};

const TRUST = ['MIT', 'SSR', 'Type-safe', 'Satu binary', 'Mobile-first', 'Ramah AI agent'];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Stack gap={0} align="center">
      <Text fz={28} fw={800} lh={1.1}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        {label}
      </Text>
    </Stack>
  );
}

/** Headline, value proposition, CTAs, trust strip, live numbers, and a terminal mock. */
export function Hero({
  appName,
  tagline,
  stats,
  signedIn,
  homePath,
}: {
  appName: string;
  tagline: string;
  stats: LandingStats;
  signedIn: boolean;
  homePath: string;
}) {
  return (
    <Box component="section" pt={{ base: 48, md: 80 }} pb={{ base: 40, md: 64 }}>
      <Container size="lg">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48} style={{ alignItems: 'center' }}>
          <Stack gap="lg">
            <Badge variant="light" size="lg" radius="sm" w="fit-content">
              v{stats.version} · open source
            </Badge>
            <Title order={1} fz={{ base: 36, md: 52 }} lh={1.08} fw={800}>
              Fullstack Bun yang siap produksi, bukan sekadar starter.
            </Title>
            <Text size="lg" c="dimmed" maw={560}>
              {appName} menyatukan Elysia, React Router SSR, Drizzle, dan Better Auth dalam satu
              proses, lalu menambahkan konsol admin lengkap: user, sesi, log, audit, rate limit, dan
              settings runtime. {tagline}.
            </Text>
            <Group gap="sm" wrap="wrap">
              <Button
                component={Link}
                to={signedIn ? homePath : '/login'}
                size="md"
                rightSection={<FiArrowRight size={16} />}
                prefetch="intent"
              >
                {signedIn ? 'Buka konsol' : 'Coba konsolnya'}
              </Button>
              <Button
                component="a"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="md"
                variant="default"
                leftSection={<FiGithub size={16} />}
              >
                Lihat di GitHub
              </Button>
            </Group>
            <Group gap="xs" wrap="wrap">
              {TRUST.map((t) => (
                <Group key={t} gap={4} wrap="nowrap">
                  <FiCheck size={13} color="var(--mantine-color-teal-6)" />
                  <Text size="sm" c="dimmed">
                    {t}
                  </Text>
                </Group>
              ))}
            </Group>
          </Stack>
          <Stack gap="md">
            <Paper
              withBorder
              radius="lg"
              p="md"
              style={{
                background: 'var(--mantine-color-dark-8)',
                color: 'var(--mantine-color-gray-2)',
              }}
            >
              <Group gap={6} mb="sm">
                <Box w={10} h={10} style={{ borderRadius: 999, background: '#ff5f57' }} />
                <Box w={10} h={10} style={{ borderRadius: 999, background: '#febc2e' }} />
                <Box w={10} h={10} style={{ borderRadius: 999, background: '#28c840' }} />
                <Text size="xs" c="gray.5" ml="xs">
                  terminal
                </Text>
              </Group>
              <Code block bg="transparent" c="gray.2" style={{ fontSize: 13, padding: 0 }}>
                {`$ bun install && bun run db:migrate
$ bun run dev
🚀 ${appName} dev server on http://localhost:3005
   API + SSR + HMR — satu port, tanpa proxy

$ bun run build:binary:linux
✓ ${appName.toLowerCase()}-linux-x64  (runtime + SSR + assets)`}
              </Code>
            </Paper>
            <Paper withBorder radius="lg" p="md">
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                <Stat value={String(stats.consolePages)} label="halaman konsol" />
                <Stat value={String(stats.tables)} label="tabel siap pakai" />
                <Stat value={String(stats.mcpTools)} label="tool MCP untuk agent" />
                <Stat
                  value={stats.testFiles > 0 ? String(stats.testFiles) : '—'}
                  label="file test"
                />
              </SimpleGrid>
            </Paper>
          </Stack>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

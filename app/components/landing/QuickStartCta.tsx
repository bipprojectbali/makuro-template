import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Code,
  Container,
  CopyButton,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { FiArrowRight, FiCheck, FiCopy, FiGithub, FiZap } from 'react-icons/fi';
import { Link } from 'react-router';
import { GITHUB_URL, QUICK_START } from './landing.content';

export function QuickStartSection() {
  return (
    <Box
      component="section"
      py={{ base: 40, md: 72 }}
      style={{ background: 'var(--mantine-color-default-hover)' }}
    >
      <Container size="lg">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ alignItems: 'center' }}>
          <Stack gap="sm" id="mulai" style={{ scrollMarginTop: 80 }}>
            <Text size="xs" c="blue" fw={700} tt="uppercase" lts={1}>
              Mulai
            </Text>
            <Title order={2} fz={{ base: 28, md: 36 }} lh={1.15}>
              Dari clone ke konsol admin dalam lima perintah
            </Title>
            <Text c="dimmed">
              Yang wajib hanya PostgreSQL dan Bun di mesin dev. Untuk produksi, cukup binary hasil
              build dan URL database. Google OAuth dan token MCP opsional.
            </Text>
            <Group gap="sm" mt="xs">
              <Button
                component="a"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<FiGithub size={16} />}
              >
                Clone repo
              </Button>
              <Button
                component="a"
                href={`${GITHUB_URL}#readme`}
                target="_blank"
                rel="noopener noreferrer"
                variant="default"
              >
                Baca README
              </Button>
            </Group>
          </Stack>
          <Box pos="relative">
            <Code block style={{ fontSize: 12.5, lineHeight: 1.6, paddingRight: 44 }}>
              {QUICK_START}
            </Code>
            <CopyButton value={QUICK_START} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Tersalin' : 'Salin perintah'} withArrow>
                  <ActionIcon
                    variant="light"
                    color={copied ? 'teal' : 'gray'}
                    onClick={copy}
                    aria-label="Salin perintah"
                    pos="absolute"
                    top={8}
                    right={8}
                  >
                    {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Box>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

export function CtaSection({ signedIn, homePath }: { signedIn: boolean; homePath: string }) {
  return (
    <Container size="md" component="section" py={{ base: 48, md: 80 }}>
      <Stack align="center" gap="md" ta="center">
        <Title order={2} fz={{ base: 28, md: 40 }} lh={1.1}>
          Berhenti merakit fondasi. Mulai dari fitur.
        </Title>
        <Text c="dimmed" maw={560}>
          Auth, konsol admin, analytics, audit, rate limit, dan deploy satu binary sudah jadi.
          Sisanya adalah produk Anda.
        </Text>
        <Group gap="sm" wrap="wrap" justify="center">
          <Button
            component={Link}
            to={signedIn ? homePath : '/login'}
            size="md"
            rightSection={<FiArrowRight size={16} />}
            prefetch="intent"
          >
            {signedIn ? 'Buka konsol' : 'Masuk ke konsol'}
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
            Star di GitHub
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}

export function LandingFooter({
  appName,
  version,
  supportUrl,
}: {
  appName: string;
  version: string;
  supportUrl: string | null;
}) {
  return (
    <Box
      component="footer"
      py="xl"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Container size="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Group gap={8}>
            <FiZap size={16} />
            <Text fw={700}>{appName}</Text>
            <Text size="sm" c="dimmed">
              v{version} · MIT License
            </Text>
          </Group>
          <Group gap="lg" wrap="wrap">
            <Anchor href="#fitur" size="sm" c="dimmed">
              Fitur
            </Anchor>
            <Anchor href="#konsol" size="sm" c="dimmed">
              Konsol
            </Anchor>
            <Anchor
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              c="dimmed"
            >
              GitHub
            </Anchor>
            {supportUrl && (
              <Anchor
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                c="dimmed"
              >
                Dukungan
              </Anchor>
            )}
            <Anchor component={Link} to="/login" size="sm" c="dimmed">
              Masuk
            </Anchor>
          </Group>
        </Group>
        <Divider my="md" />
        <Text size="xs" c="dimmed">
          Dibangun dengan Bun, Elysia, React Router, Drizzle, Better Auth, dan Mantine. Angka di
          halaman ini dihitung langsung dari kode yang berjalan.
        </Text>
      </Container>
    </Box>
  );
}

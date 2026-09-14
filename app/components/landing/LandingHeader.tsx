import { Anchor, Box, Button, Container, Group, Text } from '@mantine/core';
import { FiGithub, FiLogIn, FiZap } from 'react-icons/fi';
import { Link } from 'react-router';
import { GITHUB_URL } from './landing.content';

const LINKS = [
  { href: '#fitur', label: 'Fitur' },
  { href: '#konsol', label: 'Konsol' },
  { href: '#keamanan', label: 'Keamanan' },
  { href: '#arsitektur', label: 'Arsitektur' },
  { href: '#mulai', label: 'Mulai' },
  { href: '#faq', label: 'FAQ' },
];

/** Sticky top bar: brand, section anchors, GitHub, and a session-aware CTA. */
export function LandingHeader({
  appName,
  signedIn,
  homePath,
}: {
  appName: string;
  signedIn: boolean;
  homePath: string;
}) {
  return (
    <Box
      component="header"
      pos="sticky"
      top={0}
      style={{
        zIndex: 10,
        backdropFilter: 'blur(10px)',
        background: 'color-mix(in srgb, var(--mantine-color-body) 80%, transparent)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Container size="lg" py="sm">
        <Group justify="space-between" wrap="nowrap">
          <Anchor component={Link} to="/" underline="never" c="inherit">
            <Group gap={8} wrap="nowrap">
              <FiZap size={20} />
              <Text fw={800} size="lg">
                {appName}
              </Text>
            </Group>
          </Anchor>
          <Group gap="lg" visibleFrom="md">
            {LINKS.map((l) => (
              <Anchor key={l.href} href={l.href} size="sm" c="dimmed" underline="never">
                {l.label}
              </Anchor>
            ))}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Button
              component="a"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<FiGithub size={16} />}
              visibleFrom="sm"
            >
              GitHub
            </Button>
            <Button
              component={Link}
              to={signedIn ? homePath : '/login'}
              size="sm"
              leftSection={<FiLogIn size={14} />}
              prefetch="intent"
            >
              {signedIn ? 'Buka konsol' : 'Masuk'}
            </Button>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}

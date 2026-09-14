import {
  Anchor,
  Button,
  Code,
  Collapse,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiCompass,
  FiHome,
  FiLock,
  FiLogIn,
  FiRefreshCw,
} from 'react-icons/fi';
import { Link, useLocation } from 'react-router';
import { type ErrorInfo, type ErrorKind, errorReference } from '~/lib/error-page';

const ICON: Record<ErrorKind, { icon: IconType; color: string }> = {
  'not-found': { icon: FiCompass, color: 'blue' },
  forbidden: { icon: FiLock, color: 'orange' },
  unauthorized: { icon: FiLogIn, color: 'yellow' },
  server: { icon: FiAlertTriangle, color: 'red' },
  unavailable: { icon: FiClock, color: 'gray' },
  other: { icon: FiAlertTriangle, color: 'orange' },
};

type Props = {
  info: ErrorInfo;
  /** Where "Ke beranda" goes — the area's home when inside a console, else "/". */
  homePath?: string;
  homeLabel?: string;
  /** Rendered inside a console shell (tighter, no page-level centering). */
  embedded?: boolean;
};

/**
 * The body of every error page: status, plain-language title/description,
 * what to do next, a support reference, and actions that actually help
 * (back, reload, home, login). Developer details only in development.
 */
export function ErrorPanel({
  info,
  homePath = '/',
  homeLabel = 'Ke beranda',
  embedded = false,
}: Props) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { icon: Icon, color } = ICON[info.kind];
  const reference = errorReference();
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
  const isServer = info.kind === 'server' || info.kind === 'unavailable';

  return (
    <Paper
      withBorder={embedded}
      radius="md"
      p={embedded ? { base: 'md', md: 'xl' } : 0}
      maw={560}
      w="100%"
      mx="auto"
      bg={embedded ? undefined : 'transparent'}
    >
      <Stack gap="md" align={embedded ? 'flex-start' : 'center'} ta={embedded ? 'left' : 'center'}>
        <Group gap="md" wrap="nowrap" align="center">
          <ThemeIcon size={56} radius="md" variant="light" color={color}>
            <Icon size={28} />
          </ThemeIcon>
          <Text fz={44} fw={800} lh={1} lts={-1} c="dimmed" style={{ opacity: 0.6 }}>
            {info.status}
          </Text>
        </Group>
        <div>
          <Text component="h1" fz="xl" fw={700} lh={1.2} m={0}>
            {info.title}
          </Text>
          <Text size="sm" c="dimmed" mt={6}>
            {info.description}
          </Text>
          <Text size="sm" mt={4}>
            {info.hint}
          </Text>
        </div>
        <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: 'break-all' }}>
          {pathname}
          {isServer ? ` · ${reference} · ${new Date().toLocaleString('id-ID')}` : ''}
        </Text>
        <Group gap="xs" wrap="wrap" justify={embedded ? 'flex-start' : 'center'}>
          {canGoBack && (
            <Button
              size="sm"
              variant="default"
              leftSection={<FiArrowLeft size={14} />}
              onClick={() => window.history.back()}
            >
              Kembali
            </Button>
          )}
          {isServer && (
            <Button
              size="sm"
              variant="light"
              leftSection={<FiRefreshCw size={14} />}
              onClick={() => window.location.reload()}
            >
              Muat ulang
            </Button>
          )}
          {info.kind === 'unauthorized' ? (
            <Button size="sm" component={Link} to="/login" leftSection={<FiLogIn size={14} />}>
              Masuk
            </Button>
          ) : (
            <Button size="sm" component={Link} to={homePath} leftSection={<FiHome size={14} />}>
              {homeLabel}
            </Button>
          )}
        </Group>
        {info.detail && (
          <Stack gap={4} w="100%">
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="dimmed"
              onClick={() => setOpen((o) => !o)}
            >
              <Group gap={4} component="span">
                {open ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                Detail teknis (hanya di development)
              </Group>
            </Anchor>
            <Collapse expanded={open}>
              <Code block style={{ fontSize: 11, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {info.detail}
              </Code>
            </Collapse>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

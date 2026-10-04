import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Code,
  CopyButton,
  Group,
  List,
  Modal,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { CLOUDFLARE_IP_RANGES } from '@server/middleware/cloudflare-ips';
import type { ProxyHealth, ProxySetup } from '@server/middleware/proxy-health';
import { FiAlertTriangle, FiCheck, FiCopy } from 'react-icons/fi';
import { Link } from 'react-router';

const LOOPBACK = '127.0.0.1,::1';

const ISSUE_TEXT: Record<
  ProxyHealth['issue'],
  { title: string; body: (p: string | null) => string }
> = {
  'catch-all': {
    title: 'TRUSTED_PROXIES memercayai semua alamat',
    body: () =>
      'Ada entri /0, sehingga setiap klien bisa memalsukan IP-nya. Rate limit dan log IP tidak bisa dipercaya.',
  },
  'untrusted-proxy': {
    title: 'Request Anda lewat proxy yang belum dipercaya',
    body: (peer) =>
      `Server menerima X-Forwarded-For dari ${peer ?? 'proxy'} tetapi mengabaikannya. Semua pengunjung tercatat dengan IP proxy dan berbagi satu kuota rate limit.`,
  },
  'cloudflare-edge-ip': {
    title: 'IP Anda terbaca sebagai IP Cloudflare',
    body: () =>
      'Proxy lokal sudah dipercaya, tetapi rentang IP Cloudflare belum. Semua pengunjung tercatat dengan IP edge Cloudflare.',
  },
};

const SETUPS: Array<{ key: ProxySetup; label: string; note: string }> = [
  {
    key: 'cloudflare',
    label: 'Cloudflare',
    note: 'Server menerima koneksi langsung dari edge Cloudflare. Bila ada nginx di host yang sama, tambahkan juga 127.0.0.1,::1.',
  },
  {
    key: 'cloudflare-tunnel',
    label: 'Cloudflare Tunnel',
    note: 'Koneksi datang dari cloudflared, bukan dari Cloudflare. Isi dengan IP cloudflared (loopback bila satu host, IP container bila di Docker).',
  },
  {
    key: 'reverse-proxy',
    label: 'nginx / lainnya',
    note: 'Isi dengan IP atau CIDR reverse proxy yang meneruskan request ke app.',
  },
];

function suggestedValue(setup: ProxySetup, peerIp: string | null): string {
  if (setup === 'cloudflare') return CLOUDFLARE_IP_RANGES.join(',');
  return peerIp && peerIp !== '127.0.0.1' ? peerIp : LOOPBACK;
}

function CopyValue({ value }: { value: string }) {
  const line = `TRUSTED_PROXIES=${value}`;
  return (
    <Box pos="relative">
      <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', paddingRight: 44 }}>
        {line}
      </Code>
      <CopyButton value={line} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Tersalin' : 'Salin baris .env'} withArrow>
            <ActionIcon
              variant="light"
              color={copied ? 'teal' : 'gray'}
              onClick={copy}
              aria-label="Salin baris .env"
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
  );
}

/** Step-by-step TRUSTED_PROXIES guide; opens on the setup detected from the request. */
function ProxyGuide({ health }: { health: ProxyHealth }) {
  const detected = SETUPS.find((s) => s.key === health.setup)?.label;
  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="wrap">
        <Text size="sm">Terdeteksi:</Text>
        <Badge variant="light">{detected}</Badge>
        {health.peerIp && <Badge variant="outline">proxy {health.peerIp}</Badge>}
      </Group>
      <Tabs defaultValue={health.setup} keepMounted={false}>
        <Tabs.List>
          {SETUPS.map((s) => (
            <Tabs.Tab key={s.key} value={s.key}>
              {s.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {SETUPS.map((s) => (
          <Tabs.Panel key={s.key} value={s.key} pt="sm">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                {s.note}
              </Text>
              <CopyValue value={suggestedValue(s.key, health.peerIp)} />
            </Stack>
          </Tabs.Panel>
        ))}
      </Tabs>
      <List type="ordered" size="sm" spacing={4}>
        <List.Item>
          Tempel baris di atas ke <Code>.env</Code> (atau env deploy). Hapus entri /0 bila ada.
        </List.Item>
        <List.Item>Restart server agar nilainya dibaca ulang.</List.Item>
        <List.Item>
          Buka <Code>/dev/tools</Code> → Status proses: &quot;IP Anda&quot; harus IP publik Anda,
          bukan IP proxy.
        </List.Item>
      </List>
      <Text size="xs" c="dimmed">
        Rentang IP Cloudflare sesekali berubah; cocokkan dengan cloudflare.com/ips.
      </Text>
    </Stack>
  );
}

/** Shown in the /dev layout while TRUSTED_PROXIES looks wrong; dismissal lasts until a restart. */
export function ProxySetupBanner({ health }: { health: ProxyHealth }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [dismissed, setDismissed] = useLocalStorage<number>({
    key: 'makuro:proxy-banner-dismissed',
    defaultValue: 0,
  });
  if (dismissed === health.bootId) return null;
  const text = ISSUE_TEXT[health.issue];
  return (
    <Box px={{ base: 'sm', md: 'md' }} pt={{ base: 'sm', md: 'md' }}>
      <Alert
        color="orange"
        variant="light"
        icon={<FiAlertTriangle size={16} />}
        title={text.title}
        withCloseButton
        closeButtonLabel="Sembunyikan sampai server restart"
        onClose={() => setDismissed(health.bootId)}
      >
        <Stack gap="xs">
          <Text size="sm">{text.body(health.peerIp)}</Text>
          <Group gap="xs" wrap="wrap">
            <Button size="xs" variant="light" color="orange" onClick={open}>
              Lihat panduan TRUSTED_PROXIES
            </Button>
            <Button component={Link} to="/dev/tools" size="xs" variant="subtle" prefetch="intent">
              Cek status proses
            </Button>
          </Group>
        </Stack>
      </Alert>
      <Modal opened={opened} onClose={close} title="Atur TRUSTED_PROXIES" size="lg">
        <ProxyGuide health={health} />
      </Modal>
    </Box>
  );
}

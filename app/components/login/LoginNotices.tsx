import { Alert, Anchor, Text } from '@mantine/core';
import { FiAlertCircle, FiInfo, FiSlash } from 'react-icons/fi';
import type { AuthNotice } from '~/lib/auth-errors';

const STYLE: Record<AuthNotice['kind'], { color: string; icon: React.ReactNode }> = {
  banned: { color: 'red', icon: <FiSlash size={16} /> },
  session: { color: 'blue', icon: <FiInfo size={16} /> },
  info: { color: 'blue', icon: <FiInfo size={16} /> },
  error: { color: 'red', icon: <FiAlertCircle size={16} /> },
};

/** Alert above the login form: ban, ended session, or a mapped auth error. */
export function LoginNotice({
  notice,
  supportUrl,
}: {
  notice: AuthNotice | null;
  supportUrl?: string | null;
}) {
  if (!notice) return null;
  const s = STYLE[notice.kind];
  return (
    <Alert color={s.color} icon={s.icon} title={notice.title} variant="light" radius="md">
      <Text size="sm">{notice.message}</Text>
      {notice.kind === 'banned' && supportUrl && (
        <Text size="sm" mt={4}>
          <Anchor href={supportUrl} target="_blank" rel="noreferrer" size="sm">
            Hubungi dukungan
          </Anchor>
        </Text>
      )}
    </Alert>
  );
}

import { Center } from '@mantine/core';
import type { ReactNode } from 'react';
import { describeError } from '~/lib/error-page';
import { ErrorPage } from './ErrorPage';
import { ErrorPanel } from './ErrorPanel';

type Props = {
  error: unknown;
  homePath: string;
  homeLabel: string;
  /** Wraps the panel in the area's shell when the layout loader succeeded; absent = standalone page. */
  children?: (panel: ReactNode) => ReactNode;
};

/**
 * Error boundary body for a console/area layout: inside the sidebar shell when
 * the layout's own data is available (child route failed), otherwise the
 * standalone page (the layout loader itself failed, e.g. auth redirect race).
 */
export function AreaErrorBoundary({ error, homePath, homeLabel, children }: Props) {
  if (!children) return <ErrorPage error={error} />;
  const info = describeError(error, import.meta.env.DEV);
  return children(
    <Center p={{ base: 'sm', md: 'xl' }} mih="60vh">
      <ErrorPanel info={info} homePath={homePath} homeLabel={homeLabel} embedded />
    </Center>,
  );
}

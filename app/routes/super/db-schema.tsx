import { Center, Loader, Text } from '@mantine/core';
import { introspectDrizzleSchema } from '@server/db/schema-introspect';
import { lazy, Suspense } from 'react';
import type { Route } from './+types/db-schema';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'DB Schema — Makuro Dev' }];
}

// Lazy-load the React Flow component — it uses browser-only APIs and must not
// render on the server during SSR.
const DbSchemaGraph = lazy(() =>
  import('~/components/DbSchemaGraph').then((m) => ({ default: m.DbSchemaGraph })),
);

export async function loader(_: Route.LoaderArgs) {
  return { schema: introspectDrizzleSchema() };
}

export default function DbSchemaPage({ loaderData }: Route.ComponentProps) {
  return (
    <div style={{ height: 'calc(100vh - 60px)', width: '100%' }}>
      <Suspense
        fallback={
          <Center h="100%" style={{ gap: 8 }}>
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading schema…
            </Text>
          </Center>
        }
      >
        <DbSchemaGraph schema={loaderData.schema} />
      </Suspense>
    </div>
  );
}

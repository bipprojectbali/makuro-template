import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

/**
 * One QueryClient per SSR request and one per browser tab. A module-level client
 * shares cache across requests/users on the server: loader `initialData` is then
 * ignored for existing keys and SSR renders stale `isFetching` state the client
 * does not — a hydration mismatch that regenerates the whole app on the client.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

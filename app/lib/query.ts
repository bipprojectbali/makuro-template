import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient. On the server a fresh instance per request is ideal,
 * but for a base template a single client with SSR-safe defaults is fine.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

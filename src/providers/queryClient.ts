import { QueryClient } from '@tanstack/react-query';

/**
 * The one React Query cache. Module-level (not component state) so the auth
 * flows can clear it: query keys like ['me'] or ['my-assets'] are not
 * per-user, so a cache that survives an account switch shows the previous
 * person's data to the next one for up to `staleTime`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

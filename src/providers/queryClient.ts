import { MutationCache, QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { apiErrorMessage } from '@utils/apiError';
import { toast } from '@utils/toast';

/**
 * What a mutation may pass as `meta` (typed for every useMutation):
 *   successMessage  opt-in success toast once the mutation succeeds;
 *   errorToast      opt-in error toast with the server's message. Off by
 *                   default: most screens already show mutation errors
 *                   inline, so a global toast would show them twice;
 *   silentError     suppresses errorToast (screens that handle it inline).
 */
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      successMessage?: string;
      errorToast?: boolean;
      silentError?: boolean;
    };
  }
}

/**
 * The one React Query cache. Module-level (not component state) so the auth
 * flows can clear it: query keys like ['me'] or ['my-assets'] are not
 * per-user, so a cache that survives an account switch shows the previous
 * person's data to the next one for up to `staleTime`.
 *
 * The MutationCache raises the global toasts (see @utils/toast).
 */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (!mutation.meta?.errorToast || mutation.meta.silentError) return;
      toast.error(apiErrorMessage(err));
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const message = mutation.meta?.successMessage;
      if (message) toast.success(message);
    },
  }),
  defaultOptions: {
    queries: {
      // A 4xx (no access, not found, bad input) won't change on a retry, so
      // show it at once instead of holding "Loading…" through the backoff.
      retry: (failureCount, err) => {
        const status = err instanceof AxiosError ? err.response?.status : undefined;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

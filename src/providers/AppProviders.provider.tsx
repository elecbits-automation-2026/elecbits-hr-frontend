import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';

import { queryClient } from '@providers/queryClient';

/**
 * Global providers, composed in one place. React Query owns all server state
 * (there is no duplicate cache in zustand — the auth store holds only the
 * session). The client lives at module level (`queryClient.ts`) so sign-in
 * and sign-out can clear it.
 */
const AppProviders = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);

export default AppProviders;

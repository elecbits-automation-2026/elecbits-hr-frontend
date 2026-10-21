import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Session } from '@app-types/api.types';

/**
 * Session state (zustand, persisted to localStorage so a refresh keeps the
 * user signed in). Holds IDENTITY only — what the user may do comes from
 * GET /me on every load, never from anything cached here, so a revoked grant
 * takes effect on the next request (design doc §10).
 */
interface AuthState {
  accessToken: string | null;
  user: Session['user'] | null;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (session) => set({ accessToken: session.accessToken, user: session.user }),
      clearSession: () => set({ accessToken: null, user: null }),
    }),
    { name: 'elecbits-hr-session' },
  ),
);

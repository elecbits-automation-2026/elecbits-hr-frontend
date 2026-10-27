import type { Session } from '@app-types/api.types';
import { queryClient } from '@providers/queryClient';
import { useAuthStore } from '@store/auth.store';
import { api } from '@utils/axiosInstance';

/**
 * Auth flows (design doc §5): sign in, claim the record HRBP created, and the
 * one-time org claim. Each stores the returned session so the interceptor can
 * attach the token; the server also sets the httpOnly refresh cookie the
 * interceptor renews it with. Every session change clears the query cache —
 * cached "my" data must never carry over to the next person.
 */
export const authService = {
  login: async (email: string, password: string): Promise<Session> => {
    const { data } = await api.post<Session>('/auth/login', { email, password });
    queryClient.clear();
    useAuthStore.getState().setSession(data);
    return data;
  },

  claimRecord: async (email: string, password: string, token: string): Promise<Session> => {
    // `token` is the single-use invite token from the claim link HR shared.
    const { data } = await api.post<Session>('/auth/claim', { email, password, token });
    queryClient.clear();
    useAuthStore.getState().setSession(data);
    return data;
  },

  /**
   * Sign out here AND on the server: the refresh cookie's sign-in is revoked,
   * so the session can't be renewed from this browser. Local state clears
   * immediately; a network failure still leaves the user signed out here.
   */
  logout: (): void => {
    useAuthStore.getState().clearSession();
    queryClient.clear();
    void api.post('/auth/logout').catch(() => undefined);
  },

  isSignedIn: (): boolean => useAuthStore.getState().accessToken !== null,
};

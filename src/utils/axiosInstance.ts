import axios, { type InternalAxiosRequestConfig } from 'axios';

import type { Session } from '@app-types/api.types';
import { useAuthStore } from '@store/auth.store';

const baseURL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

/**
 * The single Axios instance every service uses. Base URL comes from the env
 * (local backend now; the deployed API later — only .env changes).
 *
 * `withCredentials` lets the browser send the httpOnly refresh cookie to the
 * auth routes (it is path-scoped there; page scripts can never read it). The
 * request interceptor attaches the short-lived access token; on a 401 the
 * response interceptor renews it ONCE through /auth/refresh and replays the
 * request. Only when renewal fails (expired, logged out elsewhere,
 * deactivated, replayed token) does the user land on the login screen —
 * grants are checked server-side per request (design doc §10), so a
 * revocation shows up here as exactly that failure.
 */
export const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * One renewal at a time: every request that 401s while a refresh is in
 * flight waits on the same promise instead of rotating the cookie again.
 * Uses bare axios so the refresh call never re-enters these interceptors.
 */
let refreshing: Promise<string> | null = null;
const renewAccessToken = (): Promise<string> => {
  refreshing ??= axios
    .post<Session>(`${baseURL}/auth/refresh`, null, { withCredentials: true })
    .then(({ data }) => {
      useAuthStore.getState().setSession(data);
      return data.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

const endSession = () => {
  useAuthStore.getState().clearSession();
  // The route guard reads the store non-reactively, so an expired session
  // would otherwise leave a dead page of failing queries (review finding
  // M1). A hard redirect guarantees the login screen from anywhere.
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.assign('/auth');
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    // A 401 from login/claim is "wrong credentials", not an expired session —
    // never bounce the auth screen while someone is typing their password.
    const isAuthCall = (config?.url ?? '').includes('/auth/');
    if (status !== 401 || isAuthCall || !config) return Promise.reject(error);

    if (config._retried) {
      endSession();
      return Promise.reject(error);
    }
    try {
      const token = await renewAccessToken();
      config._retried = true;
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    } catch {
      endSession();
      return Promise.reject(error);
    }
  },
);

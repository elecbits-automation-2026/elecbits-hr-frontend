import type { EmailStatus } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Email delivery (Admin): status, retry what failed, send yourself a test. */
export const emailApi = {
  status: async (): Promise<EmailStatus> => (await api.get<EmailStatus>('/admin/email')).data,
  retryFailed: async (): Promise<{ requeued: number }> =>
    (await api.post<{ requeued: number }>('/admin/email/retry-failed')).data,
  sendTest: async (): Promise<{ sentTo: string; driver: 'log' | 'gmail' }> =>
    (await api.post<{ sentTo: string; driver: 'log' | 'gmail' }>('/admin/email/test')).data,
};

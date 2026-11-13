import type { CreatePipInput, Pip } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Performance improvement plans: the RM opens one; it runs 60 days at once
 * (HR and the employee are told) and the RM records the outcome at the end.
 */
export const pipApi = {
  list: async (employeeId?: string): Promise<Pip[]> =>
    (await api.get<Pip[]>('/pips', { params: employeeId ? { employeeId } : {} })).data,
  get: async (id: string): Promise<Pip> => (await api.get<Pip>(`/pips/${id}`)).data,
  /** The RM — or HR when the person has no RM — and nothing running. */
  canStart: async (employeeId: string): Promise<boolean> =>
    (await api.get<{ canStart: boolean }>(`/pips/can-start/${employeeId}`)).data.canStart,
  create: async (input: CreatePipInput): Promise<Pip> =>
    (await api.post<Pip>('/pips', input)).data,
  outcome: async (
    id: string,
    input: { outcome: 'passed' | 'extend' | 'not_passed'; note: string },
  ): Promise<Pip> => (await api.post<Pip>(`/pips/${id}/outcome`, input)).data,
  cancel: async (id: string, note: string): Promise<Pip> =>
    (await api.post<Pip>(`/pips/${id}/cancel`, { note })).data,
};

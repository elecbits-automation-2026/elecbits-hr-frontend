import type { CreatePipInput, Pip, PipRating } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Performance improvement plans: the RM opens one (60 days, check-in every
 * 2 weeks), HR approves, the employee acknowledges.
 */
export const pipApi = {
  list: async (employeeId?: string): Promise<Pip[]> =>
    (await api.get<Pip[]>('/pips', { params: employeeId ? { employeeId } : {} })).data,
  get: async (id: string): Promise<Pip> => (await api.get<Pip>(`/pips/${id}`)).data,
  create: async (input: CreatePipInput): Promise<Pip> =>
    (await api.post<Pip>('/pips', input)).data,
  decide: async (id: string, input: { approve: boolean; note?: string }): Promise<Pip> =>
    (await api.post<Pip>(`/pips/${id}/decide`, input)).data,
  acknowledge: async (id: string): Promise<Pip> =>
    (await api.post<Pip>(`/pips/${id}/acknowledge`)).data,
  checkin: async (id: string, input: { rating: PipRating; note: string }): Promise<Pip> =>
    (await api.post<Pip>(`/pips/${id}/checkins`, input)).data,
  outcome: async (
    id: string,
    input: { outcome: 'passed' | 'extend' | 'not_passed'; note: string },
  ): Promise<Pip> => (await api.post<Pip>(`/pips/${id}/outcome`, input)).data,
  cancel: async (id: string, note: string): Promise<Pip> =>
    (await api.post<Pip>(`/pips/${id}/cancel`, { note })).data,
};

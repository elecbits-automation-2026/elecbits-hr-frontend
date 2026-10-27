import type { QuarterCycle, QuarterReport, QuarterView } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** CGP quarter reports: HR closes a quarter, managers set final scores. */
export const quarterReportsApi = {
  cycles: async (): Promise<QuarterCycle[]> =>
    (await api.get<QuarterCycle[]>('/quarter-reports/cycles')).data,
  /** hrbp.people update, org. `early` closes the running quarter now. */
  close: async (name: string, early: boolean): Promise<QuarterCycle> =>
    (await api.post<QuarterCycle>(`/quarter-reports/cycles/${name}/close`, { early })).data,
  /** `as: 'rm'` = only the caller's own people (the personal board). */
  view: async (name: string, opts?: { as: 'rm' }): Promise<QuarterView> =>
    (await api.get<QuarterView>(`/quarter-reports/cycles/${name}`, { params: opts })).data,
  /** One person's reports (self, their manager, or HR reach). */
  forPerson: async (employeeId: string): Promise<QuarterReport[]> =>
    (await api.get<QuarterReport[]>(`/quarter-reports/people/${employeeId}`)).data,
  mine: async (): Promise<QuarterReport[]> =>
    (await api.get<QuarterReport[]>('/quarter-reports/mine')).data,
  adjust: async (id: string, finalScore: number, reason: string): Promise<QuarterReport> =>
    (await api.patch<QuarterReport>(`/quarter-reports/${id}/score`, { finalScore, reason })).data,
};

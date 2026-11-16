import type { DailyKpi } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

const get = async (path: string, date: string): Promise<DailyKpi> =>
  (await api.get<DailyKpi>(`/daily-kpi/${path}`, { params: { date } })).data;

/** The Daily KPI page: one day, read from attendance, updates and goals. */
export const dailyKpiApi = {
  mine: (date: string) => get('mine', date),
  team: (date: string) => get('team', date),
  org: (date: string) => get('org', date),
};

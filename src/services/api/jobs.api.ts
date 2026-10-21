import type { BackgroundJobRun, BackgroundJobsOverview } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Background jobs (Admin): the scheduler, recent runs, run now. */
export const jobsApi = {
  overview: async (): Promise<BackgroundJobsOverview> =>
    (await api.get<BackgroundJobsOverview>('/admin/jobs')).data,
  runNow: async (name: string): Promise<BackgroundJobRun> =>
    (await api.post<BackgroundJobRun>(`/admin/jobs/${name}/run`)).data,
};

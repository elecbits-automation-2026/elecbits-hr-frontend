import type {
  OnboardingJourney,
  OnboardingQueueRow,
  OnboardingTeamTask,
  StartOnboardingInput,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Onboarding journeys: own checklist is me-scope; the queue is hrbp.people. */
export const onboardingApi = {
  /** OPS (assets) or payroll (salary + bank) joiner tasks. */
  teamTasks: async (owner: 'ops' | 'payroll'): Promise<OnboardingTeamTask[]> =>
    (await api.get<OnboardingTeamTask[]>(`/onboarding/team-tasks/${owner}`)).data,
  mine: async (): Promise<OnboardingJourney | null> =>
    (await api.get<OnboardingJourney | null>('/onboarding/mine')).data,
  /** The RM's joiners (Onboarding → My team). */
  team: async (): Promise<OnboardingJourney[]> =>
    (await api.get<OnboardingJourney[]>('/onboarding/team')).data,
  /** Tick with a note of what was done, or untick (no note). */
  toggleTask: async (taskId: string, note?: string): Promise<OnboardingJourney> =>
    (
      await api.post<OnboardingJourney>(
        `/onboarding/tasks/${taskId}/toggle`,
        note ? { note } : {},
      )
    ).data,
  /** A document step: the raw file as the body; uploading completes the step. */
  uploadTaskFile: async (taskId: string, file: File): Promise<OnboardingJourney> =>
    (
      await api.put<OnboardingJourney>(`/onboarding/tasks/${taskId}/file`, file, {
        params: { filename: file.name },
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
    ).data,
  /** Open the uploaded document in a new tab. */
  openTaskFile: async (taskId: string): Promise<void> => {
    const res = await api.get<Blob>(`/onboarding/tasks/${taskId}/file`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  queue: async (): Promise<OnboardingQueueRow[]> =>
    (await api.get<OnboardingQueueRow[]>('/onboarding')).data,
  forEmployee: async (employeeId: string): Promise<OnboardingJourney> =>
    (await api.get<OnboardingJourney>(`/onboarding/employee/${employeeId}`)).data,
  start: async (input: StartOnboardingInput): Promise<OnboardingJourney> =>
    (await api.post<OnboardingJourney>('/onboarding', input)).data,
};

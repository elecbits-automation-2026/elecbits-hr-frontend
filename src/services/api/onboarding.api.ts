import type {
  OnboardingJourney,
  OnboardingQueueRow,
  OnboardingTeamTask,
  StartOnboardingInput,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Onboarding journeys: own checklist is me-scope; the queue is hrbp.people. */
export const onboardingApi = {
  /** OPS (kit) or payroll (salary + bank) joiner tasks. */
  teamTasks: async (owner: 'ops' | 'payroll'): Promise<OnboardingTeamTask[]> =>
    (await api.get<OnboardingTeamTask[]>(`/onboarding/team-tasks/${owner}`)).data,
  mine: async (): Promise<OnboardingJourney | null> =>
    (await api.get<OnboardingJourney | null>('/onboarding/mine')).data,
  toggleTask: async (taskId: string): Promise<OnboardingJourney> =>
    (await api.post<OnboardingJourney>(`/onboarding/tasks/${taskId}/toggle`)).data,
  queue: async (): Promise<OnboardingQueueRow[]> =>
    (await api.get<OnboardingQueueRow[]>('/onboarding')).data,
  forEmployee: async (employeeId: string): Promise<OnboardingJourney> =>
    (await api.get<OnboardingJourney>(`/onboarding/employee/${employeeId}`)).data,
  start: async (input: StartOnboardingInput): Promise<OnboardingJourney> =>
    (await api.post<OnboardingJourney>('/onboarding', input)).data,
};

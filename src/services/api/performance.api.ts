import type {
  CreateGoalInput,
  Goal,
  LateWorkUpdate,
  MyGoals,
  MyWorkUpdates,
  TeamGoalsRow,
  TeamUpdatesRow,
  UpdateGoalInput,
  WorkUpdate,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Performance layer: weighted quarterly goals + daily work updates. Goals are
 * set by the RM-or-HR (never by the owner), progress is moved only by the
 * owner; updates are one-per-day upserts, AI-scored server-side when a key is
 * configured (null = unscored, never 0).
 */
export const performanceApi = {
  myGoals: async (): Promise<MyGoals> => (await api.get<MyGoals>('/goals/mine')).data,
  teamGoals: async (): Promise<TeamGoalsRow[]> =>
    (await api.get<TeamGoalsRow[]>('/goals/team')).data,
  /** One report's FULL goal sheet (RM-or-HR, service-gated). */
  teamMemberGoals: async (employeeId: string): Promise<MyGoals> =>
    (await api.get<MyGoals>(`/goals/team/${employeeId}`)).data,
  createGoal: async (input: CreateGoalInput): Promise<Goal> =>
    (await api.post<Goal>('/goals', input)).data,
  /** Edit a goal's definition — RM-or-HR, open quarter only. */
  updateGoal: async (id: string, input: UpdateGoalInput): Promise<Goal> =>
    (await api.patch<Goal>(`/goals/${id}`, input)).data,
  deleteGoal: async (id: string): Promise<void> => {
    await api.delete(`/goals/${id}`);
  },
  updateProgress: async (id: string, progress: number): Promise<Goal> =>
    (await api.patch<Goal>(`/goals/${id}/progress`, { progress })).data,

  myUpdates: async (days?: number): Promise<MyWorkUpdates> =>
    (await api.get<MyWorkUpdates>('/work-updates/mine', { params: { days } })).data,
  teamUpdates: async (days?: number): Promise<TeamUpdatesRow[]> =>
    (await api.get<TeamUpdatesRow[]>('/work-updates/team', { params: { days } })).data,
  /** One report's recent updates (RM-or-HR, service-gated). */
  teamMemberUpdates: async (employeeId: string, days?: number): Promise<WorkUpdate[]> =>
    (await api.get<WorkUpdate[]>(`/work-updates/team/${employeeId}`, { params: { days } })).data,
  /** Today's update, or — with a past `date` — a late entry for a missed day. */
  submitUpdate: async (input: {
    note: string;
    goalIds?: string[];
    date?: string;
  }): Promise<WorkUpdate> => (await api.post<WorkUpdate>('/work-updates', input)).data,
  /** Late entries waiting on the caller (their RM). */
  lateQueue: async (): Promise<LateWorkUpdate[]> =>
    (await api.get<LateWorkUpdate[]>('/work-updates/late')).data,
  decideLate: async (id: string, decision: 'approve' | 'decline'): Promise<WorkUpdate> =>
    (await api.post<WorkUpdate>(`/work-updates/${id}/late-decision`, { decision })).data,
};

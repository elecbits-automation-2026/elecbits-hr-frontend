import type {
  Concern,
  ConcernOutcome,
  ConcernQueueName,
  ConcernQueueSummary,
  CreateConcernInput,
  CreatedConcern,
  DirectoryEntry,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Concerns — disputes (three levels), conduct complaints and whistleblower
 * reports. Who may see or act on a case is decided per case by the backend;
 * every action returns the case as the caller now sees it.
 */
export const concernsApi = {
  create: async (input: CreateConcernInput): Promise<CreatedConcern> =>
    (await api.post<CreatedConcern>('/concerns', input)).data,
  /** Colleagues a concern can be about (never the caller). */
  people: async (): Promise<DirectoryEntry[]> =>
    (await api.get<DirectoryEntry[]>('/concerns/people')).data,
  mine: async (): Promise<Concern[]> => (await api.get<Concern[]>('/concerns/mine')).data,
  /** The queues the caller handles, with open / overdue counts. */
  queues: async (): Promise<ConcernQueueSummary[]> =>
    (await api.get<ConcernQueueSummary[]>('/concerns/queues')).data,
  queue: async (queue: ConcernQueueName): Promise<Concern[]> =>
    (await api.get<Concern[]>(`/concerns/queue/${queue}`)).data,
  get: async (id: string): Promise<Concern> => (await api.get<Concern>(`/concerns/${id}`)).data,
  note: async (id: string, input: { body: string; visibleToRaiser?: boolean }): Promise<Concern> =>
    (await api.post<Concern>(`/concerns/${id}/notes`, input)).data,
  acknowledge: async (id: string): Promise<Concern> =>
    (await api.post<Concern>(`/concerns/${id}/acknowledge`)).data,
  decide: async (id: string, decision: string): Promise<Concern> =>
    (await api.post<Concern>(`/concerns/${id}/decide`, { decision })).data,
  resolve: async (
    id: string,
    input: { outcome: ConcernOutcome; resolution: string },
  ): Promise<Concern> => (await api.post<Concern>(`/concerns/${id}/resolve`, input)).data,
  extend: async (id: string, input: { to: string; reason: string }): Promise<Concern> =>
    (await api.post<Concern>(`/concerns/${id}/extend`, input)).data,
  decline: async (id: string, input: { reason: string; relatedCode?: string }): Promise<Concern> =>
    (await api.post<Concern>(`/concerns/${id}/decline`, input)).data,
  accept: async (id: string): Promise<Concern> =>
    (await api.post<Concern>(`/concerns/${id}/accept`)).data,
  escalate: async (id: string, reason: string): Promise<Concern> =>
    (await api.post<Concern>(`/concerns/${id}/escalate`, { reason })).data,
  /** Anonymous raiser: the code + the key shown once at filing. */
  followUp: async (input: { code: string; key: string }): Promise<Concern> =>
    (await api.post<Concern>('/concerns/follow-up', input)).data,
  followUpNote: async (input: { code: string; key: string; body: string }): Promise<Concern> =>
    (await api.post<Concern>('/concerns/follow-up/notes', input)).data,
};

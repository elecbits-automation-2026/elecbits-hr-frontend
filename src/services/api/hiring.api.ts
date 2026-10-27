import type {
  DocumentReview,
  JdContent,
  ScorecardContent,
  HiringMe,
  HiringPlan,
  Requisition,
  RequisitionInput,
  RequisitionStatus,
  TaRmOption,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** TA hiring (Step B): quarterly plans, requisitions and their approvals. */
export const hiringApi = {
  me: async (): Promise<HiringMe> => (await api.get<HiringMe>('/hiring/me')).data,
  plan: async (departmentId: string, quarter: string): Promise<HiringPlan> =>
    (await api.get<HiringPlan>('/hiring/plan', { params: { departmentId, quarter } })).data,
  create: async (
    input: RequisitionInput & { departmentId: string; quarter: string },
  ): Promise<Requisition> => (await api.post<Requisition>('/hiring/requisitions', input)).data,
  update: async (id: string, input: Partial<RequisitionInput>): Promise<Requisition> =>
    (await api.patch<Requisition>(`/hiring/requisitions/${id}`, input)).data,
  submit: async (id: string): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/requisitions/${id}/submit`)).data,
  unqueue: async (id: string): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/requisitions/${id}/unqueue`)).data,
  cancel: async (id: string): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/requisitions/${id}/cancel`)).data,
  approvals: async (): Promise<Requisition[]> =>
    (await api.get<Requisition[]>('/hiring/approvals')).data,
  decide: async (
    id: string,
    input: { version: number; decision: 'approve' | 'reject'; reason?: string },
  ): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/requisitions/${id}/decide`, input)).data,
  // ── Step C ──
  saveDocument: async (
    id: string,
    kind: 'jd' | 'scorecard',
    content: JdContent | ScorecardContent,
  ): Promise<Requisition> =>
    (await api.put<Requisition>(`/hiring/requisitions/${id}/${kind}`, { content })).data,
  submitDocument: async (id: string, kind: 'jd' | 'scorecard'): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/requisitions/${id}/${kind}/submit`)).data,
  reviews: async (): Promise<DocumentReview[]> =>
    (await api.get<DocumentReview[]>('/hiring/reviews')).data,
  decideDocument: async (
    documentId: string,
    input: { version: number; decision: 'approve' | 'reject'; reason?: string },
  ): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/documents/${documentId}/decide`, input)).data,
  // Admin gives an approved line to a TA RM.
  taRms: async (): Promise<TaRmOption[]> =>
    (await api.get<TaRmOption[]>('/hiring/ta-rms')).data,
  assignTaRm: async (id: string, taRmId: string): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/requisitions/${id}/assign-ta`, { taRmId })).data,
  assignPosition: async (
    positionId: string,
    input: { recruiterId: string; weight: number },
  ): Promise<Requisition> =>
    (await api.post<Requisition>(`/hiring/positions/${positionId}/assign`, input)).data,
  list: async (status?: RequisitionStatus): Promise<Requisition[]> =>
    (await api.get<Requisition[]>('/hiring/requisitions', { params: status ? { status } : {} }))
      .data,
};

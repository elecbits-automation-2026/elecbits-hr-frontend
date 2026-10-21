import type {
  CreateReimbursementInput,
  ReimbursementClaim,
  ReimbursementStatus,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Reimbursement claims: the employee claims, their manager then Payroll
 * approve, and approved claims are paid with the next payslip.
 */
export const reimbursementsApi = {
  mine: async (): Promise<ReimbursementClaim[]> =>
    (await api.get<ReimbursementClaim[]>('/reimbursements/mine')).data,
  /** Claims waiting on the caller as their reports' manager. */
  team: async (): Promise<ReimbursementClaim[]> =>
    (await api.get<ReimbursementClaim[]>('/reimbursements/team')).data,
  /** Payroll's queue (pr.payroll, org). */
  queue: async (statuses?: ReimbursementStatus[]): Promise<ReimbursementClaim[]> =>
    (
      await api.get<ReimbursementClaim[]>('/reimbursements', {
        params: statuses?.length ? { status: statuses.join(',') } : {},
      })
    ).data,
  create: async (input: CreateReimbursementInput): Promise<ReimbursementClaim> =>
    (await api.post<ReimbursementClaim>('/reimbursements', input)).data,
  decide: async (
    id: string,
    input: { decision: 'approve' | 'decline'; reason?: string },
  ): Promise<ReimbursementClaim> =>
    (await api.post<ReimbursementClaim>(`/reimbursements/${id}/decision`, input)).data,
  cancel: async (id: string): Promise<ReimbursementClaim> =>
    (await api.post<ReimbursementClaim>(`/reimbursements/${id}/cancel`)).data,
  /** The claimant attaches (or replaces) the receipt — PDF, JPG or PNG. */
  uploadReceipt: async (id: string, file: File): Promise<ReimbursementClaim> =>
    (
      await api.put<ReimbursementClaim>(`/reimbursements/${id}/receipt`, file, {
        params: { filename: file.name },
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
    ).data,
  /** Open the receipt in a new tab (claimant, their RM, payroll). */
  openReceipt: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/reimbursements/${id}/receipt`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

import type {
  CreateReimbursementInput,
  ReimbursementClaim,
  ReimbursementStatus,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Reimbursement claims: the employee claims, PR then the Admin account
 * approve (a PR person's own claim: Admin only), and approved claims are paid
 * by bank transfer from the reimbursement sheet — not on the payslip.
 */
export const reimbursementsApi = {
  mine: async (): Promise<ReimbursementClaim[]> =>
    (await api.get<ReimbursementClaim[]>('/reimbursements/mine')).data,
  /** PR / Admin: every claim by status, and `month` = approved in that month. */
  queue: async (
    filter: { statuses?: ReimbursementStatus[]; month?: string } = {},
  ): Promise<ReimbursementClaim[]> =>
    (
      await api.get<ReimbursementClaim[]>('/reimbursements', {
        params: {
          ...(filter.statuses?.length ? { status: filter.statuses.join(',') } : {}),
          ...(filter.month ? { month: filter.month } : {}),
        },
      })
    ).data,
  /** Download the Excel bank file of approved, unpaid claims. */
  downloadBankFile: async (month?: string): Promise<void> => {
    const res = await api.get<Blob>('/reimbursements/bank-file', {
      params: month ? { month } : {},
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reimbursements-${month ?? new Date().toLocaleDateString('en-CA').slice(0, 7)}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  /** After the transfer: approved claims become paid (all or none). */
  markPaid: async (input: {
    claimIds: string[];
    paidOn: string;
    reference: string;
  }): Promise<{ paid: number; total: number }> =>
    (await api.post<{ paid: number; total: number }>('/reimbursements/mark-paid', input)).data,
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
  /** Open the receipt in a new tab (claimant, PR, Admin). */
  openReceipt: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/reimbursements/${id}/receipt`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

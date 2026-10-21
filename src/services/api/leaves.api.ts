import type {
  CreateLeaveRequestInput,
  DecideLeaveInput,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Leave requests. `/mine`, `/balances` and `/team` are self-scoped (the
 * backend keys them to the caller); the bare list is the HR queue behind
 * hrbp.leaves. A decision is approve/decline — the backend works out whether
 * the caller fills the RM slot, the HR slot, or both.
 */
export const leavesApi = {
  /** Sick-leave medical certificate: the raw file as the body (like policy PDFs). */
  uploadCertificate: async (id: string, file: File): Promise<LeaveRequest> =>
    (
      await api.put<LeaveRequest>(`/leaves/${id}/certificate`, file, {
        params: { filename: file.name },
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
    ).data,
  /** Open the certificate in a new tab. */
  openCertificate: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/leaves/${id}/certificate`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  listMine: async (): Promise<LeaveRequest[]> =>
    (await api.get<LeaveRequest[]>('/leaves/mine')).data,
  balances: async (year?: number): Promise<LeaveBalance[]> =>
    (await api.get<LeaveBalance[]>('/leaves/balances', { params: { year } })).data,
  create: async (input: CreateLeaveRequestInput): Promise<LeaveRequest> =>
    (await api.post<LeaveRequest>('/leaves', input)).data,
  cancel: async (id: string): Promise<LeaveRequest> =>
    (await api.post<LeaveRequest>(`/leaves/${id}/cancel`)).data,
  listTeam: async (): Promise<LeaveRequest[]> =>
    (await api.get<LeaveRequest[]>('/leaves/team')).data,
  /** A report's balances (RM-or-HR, service-gated; menstrual never included). */
  teamBalances: async (employeeId: string, year?: number): Promise<LeaveBalance[]> =>
    (await api.get<LeaveBalance[]>(`/leaves/team/${employeeId}/balances`, { params: { year } }))
      .data,
  listQueue: async (status?: LeaveStatus): Promise<LeaveRequest[]> =>
    (await api.get<LeaveRequest[]>('/leaves', { params: { status } })).data,
  decide: async (id: string, input: DecideLeaveInput): Promise<LeaveRequest> =>
    (await api.post<LeaveRequest>(`/leaves/${id}/decision`, input)).data,
};

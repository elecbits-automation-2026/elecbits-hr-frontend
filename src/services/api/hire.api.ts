import type {
  Application,
  BgvStatus,
  MarkHiredInput,
  MarkHiredResult,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** TA hiring Step E: the final decision, offer, BGV and hire. */
export const hireApi = {
  sendForDecision: async (id: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/send-for-decision`)).data,
  /** Hire decisions waiting for me (dept head, line's TA RM, HR head, Admin). */
  decisions: async (): Promise<Application[]> =>
    (await api.get<Application[]>('/hiring/decisions')).data,
  decide: async (
    id: string,
    input: { decision: 'approve' | 'reject'; reason?: string },
  ): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/decide`, input)).data,
  uploadOfferLetter: async (id: string, file: File): Promise<Application> =>
    (
      await api.put<Application>(`/hiring/applications/${id}/offer-letter`, file, {
        params: { filename: file.name },
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
    ).data,
  openOfferLetter: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/hiring/applications/${id}/offer-letter`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  makeOffer: async (
    id: string,
    input: { ctc: number; joiningDate: string },
  ): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/offer`, input)).data,
  setBgv: async (id: string, input: { status: BgvStatus; notes?: string }): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/bgv`, input)).data,
  declined: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/offer-declined`, { reason })).data,
  withdrawOffer: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/withdraw-offer`, { reason })).data,
  markHired: async (id: string, input: MarkHiredInput): Promise<MarkHiredResult> =>
    (await api.post<MarkHiredResult>(`/hiring/applications/${id}/hire`, input)).data,
  noShow: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/no-show`, { reason })).data,
};

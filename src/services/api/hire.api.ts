import type {
  Application,
  CandidateDocStatus,
  CandidateDocument,
  MarkHiredInput,
  MarkHiredResult,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

const openFile = async (path: string): Promise<void> => {
  const res = await api.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const putFile = async (path: string, file: File): Promise<Application> =>
  (
    await api.put<Application>(path, file, {
      params: { filename: file.name },
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })
  ).data;

/**
 * From "all rounds passed" to joining (TA workflow deck, 2026-10-27):
 * documents, the offer (TA drafts → HR Head approves + signs → TA shares),
 * the hire and HRBP's joining confirmation.
 */
export const hireApi = {
  documents: async (id: string): Promise<CandidateDocument[]> =>
    (await api.get<CandidateDocument[]>(`/hiring/applications/${id}/documents`)).data,
  addDocument: async (id: string, name: string): Promise<CandidateDocument[]> =>
    (await api.post<CandidateDocument[]>(`/hiring/applications/${id}/documents`, { name })).data,
  setDocument: async (
    id: string,
    docId: string,
    status: CandidateDocStatus,
  ): Promise<CandidateDocument[]> =>
    (await api.put<CandidateDocument[]>(`/hiring/applications/${id}/documents/${docId}`, { status }))
      .data,
  setFolder: async (id: string, link: string | null): Promise<Application> =>
    (await api.put<Application>(`/hiring/applications/${id}/folder`, { link })).data,
  uploadOfferLetter: (id: string, file: File): Promise<Application> =>
    putFile(`/hiring/applications/${id}/offer-letter`, file),
  openOfferLetter: (id: string): Promise<void> => openFile(`/hiring/applications/${id}/offer-letter`),
  saveOfferDraft: async (
    id: string,
    input: { ctc: number; joiningDate: string; terms?: string },
  ): Promise<Application> =>
    (await api.put<Application>(`/hiring/applications/${id}/offer-draft`, input)).data,
  submitOffer: async (id: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/offer/submit`)).data,
  /** Offers waiting for the HR Head. */
  pendingOffers: async (): Promise<Application[]> =>
    (await api.get<Application[]>('/hiring/offers/pending')).data,
  uploadSignedLetter: (id: string, file: File): Promise<Application> =>
    putFile(`/hiring/applications/${id}/signed-offer`, file),
  openSignedLetter: (id: string): Promise<void> => openFile(`/hiring/applications/${id}/signed-offer`),
  approveOffer: async (id: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/offer/approve`)).data,
  returnOffer: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/offer/return`, { reason })).data,
  shareOffer: async (id: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/offer`)).data,
  declined: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/offer-declined`, { reason })).data,
  withdrawOffer: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/withdraw-offer`, { reason })).data,
  markHired: async (id: string, input: MarkHiredInput): Promise<MarkHiredResult> =>
    (await api.post<MarkHiredResult>(`/hiring/applications/${id}/hire`, input)).data,
  confirmJoined: async (id: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/joined`)).data,
  noShow: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/no-show`, { reason })).data,
};

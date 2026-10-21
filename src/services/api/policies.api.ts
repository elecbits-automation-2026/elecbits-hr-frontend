import type {
  CreatePolicyInput,
  MyPolicy,
  Policy,
  PolicyAckResult,
  PolicyTracker,
  UpdatePolicyInput,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Policy library: readable by everyone; managing it needs hrbp.policies. */
export const policiesApi = {
  list: async (): Promise<Policy[]> => (await api.get<Policy[]>('/policies')).data,
  /** HR: live AND retired policies (hrbp.policies read). */
  manage: async (): Promise<Policy[]> => (await api.get<Policy[]>('/policies/manage')).data,
  retire: async (id: string): Promise<Policy> =>
    (await api.post<Policy>(`/policies/${id}/retire`)).data,
  restore: async (id: string): Promise<Policy> =>
    (await api.post<Policy>(`/policies/${id}/restore`)).data,
  mine: async (): Promise<MyPolicy[]> => (await api.get<MyPolicy[]>('/policies/mine')).data,
  acknowledge: async (id: string): Promise<PolicyAckResult> =>
    (await api.post<PolicyAckResult>(`/policies/${id}/ack`)).data,
  tracker: async (): Promise<PolicyTracker> =>
    (await api.get<PolicyTracker>('/policies/tracker')).data,
  create: async (input: CreatePolicyInput): Promise<Policy> =>
    (await api.post<Policy>('/policies', input)).data,
  update: async (id: string, input: UpdatePolicyInput): Promise<Policy> =>
    (await api.patch<Policy>(`/policies/${id}`, input)).data,
  /** Fetch the stored PDF (auth header travels with axios) and open it. */
  openDocument: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/policies/${id}/document`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  /** Store/replace the PDF in our DB — clears any external link server-side. */
  uploadDocument: async (id: string, file: File): Promise<Policy> =>
    (
      await api.put<Policy>(
        `/policies/${id}/document?filename=${encodeURIComponent(file.name)}`,
        file,
        { headers: { 'Content-Type': file.type || 'application/pdf' } },
      )
    ).data,
};

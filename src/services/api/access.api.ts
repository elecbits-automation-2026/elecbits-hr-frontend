import type {
  AuditEntry,
  Batch,
  BatchHolder,
  GrantRequest,
  GrantRequestItem,
  Module,
  RequestableBatch,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** The access model's admin surface (§3–§6): batches, requests, audit log. */
export const accessApi = {
  listBatches: async (): Promise<Batch[]> => (await api.get<Batch[]>('/batches')).data,
  listModules: async (): Promise<Module[]> => (await api.get<Module[]>('/batches/modules')).data,
  createBatch: async (input: Pick<Batch, 'name' | 'grants'> & { description?: string }) =>
    (await api.post<Batch>('/batches', input)).data,
  updateBatch: async (
    batchId: string,
    input: Pick<Batch, 'name' | 'grants'> & { description?: string },
  ) => (await api.put<Batch>(`/batches/${batchId}`, input)).data,
  listBatchHolders: async (batchId: string): Promise<BatchHolder[]> =>
    (await api.get<BatchHolder[]>(`/batches/${batchId}/holders`)).data,
  assignBatch: async (batchId: string, employeeId: string): Promise<void> => {
    await api.post(`/batches/${batchId}/assign`, { employeeId });
  },
  revokeBatch: async (batchId: string, employeeId: string): Promise<void> => {
    await api.delete(`/batches/${batchId}/assign/${employeeId}`);
  },

  // Grant requests (§5.5): HR raises for one person, Admin decides.
  listGrantRequests: async (): Promise<GrantRequest[]> =>
    (await api.get<GrantRequest[]>('/grant-requests')).data,
  myGrantRequests: async (): Promise<GrantRequest[]> =>
    (await api.get<GrantRequest[]>('/grant-requests/mine')).data,
  requestableBatches: async (): Promise<RequestableBatch[]> =>
    (await api.get<RequestableBatch[]>('/grant-requests/options')).data,
  createGrantRequest: async (input: {
    employeeId: string;
    note: string;
    items: GrantRequestItem[];
  }): Promise<GrantRequest> => (await api.post<GrantRequest>('/grant-requests', input)).data,
  decideGrantRequest: async (
    id: string,
    input: { decision: 'approve' | 'decline'; reason?: string; grantedItems?: GrantRequestItem[] },
  ): Promise<GrantRequest> =>
    (await api.post<GrantRequest>(`/grant-requests/${id}/decision`, input)).data,

  listAuditLog: async (): Promise<AuditEntry[]> =>
    (await api.get<AuditEntry[]>('/audit-log')).data,
};

import type {
  CreateRecognitionInput,
  DecideRecognitionInput,
  DirectoryEntry,
  Recognition,
  RecognitionAward,
  RecognitionBoard,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * R&R: a manager nominates their own reports (HR: the top people too), HR
 * gives the final approval, the approved-only board; approved awards pay in
 * the next month's payslip.
 */
export const recognitionsApi = {
  board: async (): Promise<RecognitionBoard> =>
    (await api.get<RecognitionBoard>('/recognitions/board')).data,
  mine: async (): Promise<Recognition[]> =>
    (await api.get<Recognition[]>('/recognitions/mine')).data,
  sent: async (): Promise<Recognition[]> =>
    (await api.get<Recognition[]>('/recognitions/sent')).data,
  pending: async (): Promise<Recognition[]> =>
    (await api.get<Recognition[]>('/recognitions/pending')).data,
  catalog: async (): Promise<RecognitionAward[]> =>
    (await api.get<RecognitionAward[]>('/recognitions/catalog')).data,
  directory: async (): Promise<DirectoryEntry[]> =>
    (await api.get<DirectoryEntry[]>('/recognitions/directory')).data,
  nominate: async (input: CreateRecognitionInput): Promise<Recognition> =>
    (await api.post<Recognition>('/recognitions', input)).data,
  decide: async (id: string, input: DecideRecognitionInput): Promise<Recognition> =>
    (await api.post<Recognition>(`/recognitions/${id}/decide`, input)).data,
};

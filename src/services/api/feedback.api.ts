import type {
  CreateFeedbackInput,
  FeedbackNote,
  FeedbackNoteHistory,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Feedback notes: system drafts, a human sends; recipients read on Home. */
export const feedbackApi = {
  send: async (input: CreateFeedbackInput): Promise<FeedbackNote> =>
    (await api.post<FeedbackNote>('/feedback', input)).data,
  mine: async (): Promise<FeedbackNote[]> =>
    (await api.get<FeedbackNote[]>('/feedback/mine')).data,
  sent: async (): Promise<FeedbackNote[]> =>
    (await api.get<FeedbackNote[]>('/feedback/sent')).data,
  /** One person's notes, for their RM or HR (body only where you wrote it). */
  about: async (employeeId: string): Promise<FeedbackNoteHistory[]> =>
    (await api.get<FeedbackNoteHistory[]>(`/feedback/about/${employeeId}`)).data,
};

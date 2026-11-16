import type { AssignTrainingInput, Training, TrainingStream } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

export const STREAM_LABEL: Record<TrainingStream, string> = {
  compliance: 'Compliance',
  leadership: 'Leadership & professional',
  company: 'Company knowledge',
  functional: 'Functional & technical',
};

/** A first guess at the stream from the title (the old tool's keyword tagging); the assigner can change it. */
export const guessStream = (title: string): TrainingStream | null => {
  const t = title.toLowerCase();
  if (/posh|safety|compliance|esd|fire|policy|code of conduct|data protection|security/.test(t)) {
    return 'compliance';
  }
  if (/lead|manag|communicat|present|negotiat|mentor|coach|feedback/.test(t)) return 'leadership';
  if (/onboard|elecbits|product|process|induction|company|culture|tool/.test(t)) return 'company';
  if (title.trim().length >= 3) return 'functional';
  return null;
};

/** Trainings: managers assign to their reports, HR to anyone; the person marks them done. */
export const trainingsApi = {
  mine: async (): Promise<Training[]> => (await api.get<Training[]>('/trainings/mine')).data,
  team: async (): Promise<Training[]> => (await api.get<Training[]>('/trainings/team')).data,
  all: async (): Promise<Training[]> => (await api.get<Training[]>('/trainings')).data,
  forPerson: async (employeeId: string): Promise<Training[]> =>
    (await api.get<Training[]>(`/trainings/person/${employeeId}`)).data,
  assign: async (
    input: AssignTrainingInput,
  ): Promise<{ assigned: number; skipped: Array<{ id: string; name: string }> }> =>
    (await api.post('/trainings', input)).data,
  complete: async (id: string, note?: string): Promise<Training> =>
    (await api.post<Training>(`/trainings/${id}/complete`, note ? { note } : {})).data,
  reopen: async (id: string): Promise<Training> =>
    (await api.post<Training>(`/trainings/${id}/reopen`)).data,
  cancel: async (id: string): Promise<Training> =>
    (await api.post<Training>(`/trainings/${id}/cancel`)).data,
  uploadCertificate: async (id: string, file: File): Promise<Training> =>
    (
      await api.put<Training>(`/trainings/${id}/certificate`, file, {
        params: { filename: file.name },
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
    ).data,
  /** Open the certificate in a new tab. */
  openCertificate: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/trainings/${id}/certificate`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

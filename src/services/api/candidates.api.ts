import type {
  Application,
  Candidate,
  CandidateInput,
  CandidateMatch,
  InterviewRound,
  MyInterview,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** TA hiring Step D: the talent pool, applications and interview scores. */
export const candidatesApi = {
  list: async (q?: string): Promise<Candidate[]> =>
    (await api.get<Candidate[]>('/hiring/candidates', { params: q ? { q } : {} })).data,
  get: async (id: string): Promise<Candidate> =>
    (await api.get<Candidate>(`/hiring/candidates/${id}`)).data,
  /** Possible duplicates before adding someone. */
  matches: async (email?: string, phone?: string): Promise<CandidateMatch[]> =>
    (
      await api.get<CandidateMatch[]>('/hiring/candidates/match', {
        params: { ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
      })
    ).data,
  create: async (input: CandidateInput): Promise<Candidate> =>
    (await api.post<Candidate>('/hiring/candidates', input)).data,
  /** The CV: the raw file as the body (like leave certificates). */
  uploadCv: async (id: string, file: File): Promise<Candidate> =>
    (
      await api.put<Candidate>(`/hiring/candidates/${id}/cv`, file, {
        params: { filename: file.name },
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
    ).data,
  openCv: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/hiring/candidates/${id}/cv`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  pipeline: async (positionId: string): Promise<Application[]> =>
    (await api.get<Application[]>(`/hiring/positions/${positionId}/applications`)).data,
  apply: async (positionId: string, candidateId: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/positions/${positionId}/applications`, { candidateId }))
      .data,
  shortlist: async (id: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/shortlist`)).data,
  startInterviews: async (id: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/start-interviews`)).data,
  reject: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/reject`, { reason })).data,
  withdraw: async (id: string, reason: string): Promise<Application> =>
    (await api.post<Application>(`/hiring/applications/${id}/withdraw`, { reason })).data,
  swapInterviewer: async (
    requisitionId: string,
    round: InterviewRound,
    interviewerId: string,
  ): Promise<void> => {
    await api.put(`/hiring/requisitions/${requisitionId}/rounds/${round}/interviewer`, {
      interviewerId,
    });
  },
  myInterviews: async (): Promise<MyInterview[]> =>
    (await api.get<MyInterview[]>('/hiring/interviews/mine')).data,
  score: async (
    applicationId: string,
    round: InterviewRound,
    input: {
      scores: Array<{ criterion: string; score: number }>;
      recommendation: 'hire' | 'no_hire';
      notes?: string;
    },
  ): Promise<Application> =>
    (
      await api.post<Application>(
        `/hiring/applications/${applicationId}/rounds/${round}/score`,
        input,
      )
    ).data,
};

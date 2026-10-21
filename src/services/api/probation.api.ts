import type { ProbationReview } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Probation (fixed two months): the RM recommends, HR confirms or ends it;
 * undecided reviews confirm by themselves a week after the date.
 */
export const probationApi = {
  list: async (): Promise<ProbationReview[]> =>
    (await api.get<ProbationReview[]>('/probation')).data,
  mine: async (): Promise<ProbationReview | null> =>
    (await api.get<ProbationReview | null>('/probation/mine')).data,
  recommend: async (
    id: string,
    input: { recommendation: 'confirm' | 'end'; note: string },
  ): Promise<ProbationReview> =>
    (await api.post<ProbationReview>(`/probation/${id}/recommend`, input)).data,
  decide: async (
    id: string,
    input: {
      decision: 'confirm' | 'end';
      note: string;
      mode?: 'serve' | 'pay_in_lieu';
      lastWorkingDay?: string;
    },
  ): Promise<ProbationReview> =>
    (await api.post<ProbationReview>(`/probation/${id}/decide`, input)).data,
  /** Save the confirmation letter PDF. */
  letter: async (id: string): Promise<void> => {
    const res = await api.get<Blob>(`/probation/${id}/letter`, { responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'confirmation-letter.pdf';
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  },
};

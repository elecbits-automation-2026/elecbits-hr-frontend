import type { Exit, ExitInterview, MyExitPage } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Hand the browser a PDF the API produced (letters, F&F statement). */
const downloadPdf = async (url: string, fallbackName: string): Promise<void> => {
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
};

/**
 * Exits: resignation or termination, the four clearances, the exit
 * interview, and the documents once the F&F is settled.
 */
export const exitsApi = {
  list: async (): Promise<Exit[]> => (await api.get<Exit[]>('/exits')).data,
  mine: async (): Promise<MyExitPage> => (await api.get<MyExitPage>('/exits/mine')).data,
  team: async (): Promise<Exit[]> => (await api.get<Exit[]>('/exits/team')).data,
  get: async (id: string): Promise<Exit> => (await api.get<Exit>(`/exits/${id}`)).data,
  resign: async (input: { reason: string; lastWorkingDay?: string }): Promise<MyExitPage> =>
    (await api.post<MyExitPage>('/exits/resign', input)).data,
  terminate: async (input: {
    employeeId: string;
    reason: string;
    mode: 'serve' | 'pay_in_lieu';
    lastWorkingDay: string;
  }): Promise<Exit> => (await api.post<Exit>('/exits/terminate', input)).data,
  withdraw: async (id: string): Promise<MyExitPage> =>
    (await api.post<MyExitPage>(`/exits/${id}/withdraw`)).data,
  acknowledge: async (id: string, handoverPlan: string): Promise<Exit> =>
    (await api.post<Exit>(`/exits/${id}/acknowledge`, { handoverPlan })).data,
  accept: async (
    id: string,
    input: {
      lastWorkingDay: string;
      shortfallAction?: 'waive' | 'recover';
      shortfallReason?: string;
    },
  ): Promise<Exit> => (await api.post<Exit>(`/exits/${id}/accept`, input)).data,
  cancel: async (id: string, reason: string): Promise<Exit> =>
    (await api.post<Exit>(`/exits/${id}/cancel`, { reason })).data,
  clear: async (id: string, kind: 'hr' | 'manager' | 'ops', note?: string): Promise<Exit> =>
    (await api.post<Exit>(`/exits/${id}/clear`, { kind, note })).data,
  interview: async (id: string, answers: ExitInterview): Promise<MyExitPage> =>
    (await api.post<MyExitPage>(`/exits/${id}/interview`, answers)).data,
  letter: (id: string, which: 'relieving' | 'experience') =>
    downloadPdf(`/exits/${id}/letters/${which}`, `${which}-letter.pdf`),
  statement: (id: string) => downloadPdf(`/payroll/exits/${id}/statement`, 'full-and-final.pdf'),
  addRecovery: async (
    id: string,
    input: { label: string; amount: number; note?: string },
  ): Promise<void> => {
    await api.post(`/payroll/exits/${id}/recoveries`, input);
  },
  removeRecovery: async (id: string, recoveryId: string): Promise<void> => {
    await api.delete(`/payroll/exits/${id}/recoveries/${recoveryId}`);
  },
};

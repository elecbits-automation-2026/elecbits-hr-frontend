import type {
  EmployeeSalary,
  Me,
  MyAsset,
  MyExit,
  TeamMember,
  UpdateMeInput,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** The signed-in employee's own view — drives which app sections render. */
export const meApi = {
  get: async (): Promise<Me> => (await api.get<Me>('/me')).data,
  update: async (input: UpdateMeInput): Promise<Me> =>
    (await api.patch<Me>('/me', input)).data,
  // Me-scoped: the backend only ever serves the caller's own salary here.
  getSalary: async (): Promise<EmployeeSalary> =>
    (await api.get<EmployeeSalary>('/me/salary')).data,
  listAssets: async (): Promise<MyAsset[]> => (await api.get<MyAsset[]>('/me/assets')).data,
  /** The caller's chain (reports + approver-only), sanitized server-side. */
  team: async (): Promise<TeamMember[]> => (await api.get<TeamMember[]>('/me/team')).data,
  getExit: async (): Promise<MyExit | null> => (await api.get<MyExit | null>('/me/exit')).data,
};

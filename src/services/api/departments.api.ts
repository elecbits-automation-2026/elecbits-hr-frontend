import type { Department } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** The department tree (§2.4). */
export const departmentsApi = {
  list: async (): Promise<Department[]> => (await api.get<Department[]>('/departments')).data,
  create: async (input: { name: string; parentId?: string }): Promise<Department> =>
    (await api.post<Department>('/departments', input)).data,
};

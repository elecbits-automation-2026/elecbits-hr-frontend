import type { Department, DepartmentMembership, UnitKind } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

export const KIND_LABEL: Record<UnitKind, string> = {
  division: 'Division',
  department: 'Department',
  chapter: 'Chapter',
};

/** Units a person can call home — a chapter is joined by membership only. */
export const homeUnits = (list: Department[] | undefined): Department[] =>
  (list ?? []).filter((d) => d.kind !== 'chapter');

/** The org units: divisions, departments and chapters (§2.4). */
export const departmentsApi = {
  list: async (): Promise<Department[]> => (await api.get<Department[]>('/departments')).data,
  memberships: async (): Promise<DepartmentMembership[]> =>
    (await api.get<DepartmentMembership[]>('/departments/memberships')).data,
  create: async (input: {
    name: string;
    kind?: UnitKind;
    parentId?: string;
  }): Promise<Department> => (await api.post<Department>('/departments', input)).data,
  update: async (
    id: string,
    input: { name?: string; kind?: UnitKind; parentId?: string | null },
  ): Promise<Department> => (await api.patch<Department>(`/departments/${id}`, input)).data,
  setHead: async (
    id: string,
    input: { employeeId: string; acting: boolean },
  ): Promise<Department> => (await api.put<Department>(`/departments/${id}/head`, input)).data,
  clearHead: async (id: string): Promise<Department> =>
    (await api.delete<Department>(`/departments/${id}/head`)).data,
  addMember: async (id: string, employeeId: string): Promise<Department> =>
    (await api.post<Department>(`/departments/${id}/members`, { employeeId })).data,
  removeMember: async (membershipId: string): Promise<Department> =>
    (await api.delete<Department>(`/departments/memberships/${membershipId}`)).data,
  setLead: async (id: string, employeeId: string | null): Promise<Department> =>
    (await api.put<Department>(`/departments/${id}/lead`, { employeeId })).data,
};

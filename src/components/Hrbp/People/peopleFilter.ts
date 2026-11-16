import type { Employee } from '@app-types/api.types';

export interface PeopleFilter {
  search: string;
  department: string;
  role: string;
}

export const EMPTY_FILTER: PeopleFilter = { search: '', department: '', role: '' };

export const NONE = '—';
export const deptOf = (e: Employee) => e.departmentName ?? NONE;
export const roleOf = (e: Employee) => e.designation?.trim() || NONE;

/** The roster narrowed by the bar below — search covers name, email, code, role and department. */
export const applyPeopleFilter = (list: Employee[], f: PeopleFilter): Employee[] => {
  const q = f.search.trim().toLowerCase();
  return list.filter(
    (e) =>
      (!f.department || deptOf(e) === f.department) &&
      (!f.role || roleOf(e) === f.role) &&
      (!q ||
        [e.name, e.email, e.employeeCode, e.designation ?? '', e.departmentName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q)),
  );
};

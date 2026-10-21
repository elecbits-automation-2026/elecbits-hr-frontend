import type {
  ClaimInfo,
  CreateEmployeeInput,
  Employee,
  IncompleteRecord,
  ImportEmployeeRow,
  ImportEmployeesResult,
  EmployeeSalary,
  EmployeeWithClaim,
  InviteEmployeeInput,
  UpdateEmployeeSalaryInput,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** People records (§2). Create/update are HRBP surfaces; invite is Admin's. */
export const employeesApi = {
  list: async (): Promise<Employee[]> => (await api.get<Employee[]>('/employees')).data,
  /**
   * Bulk import: dryRun checks every row; a real run imports all or nothing.
   * A refused real run answers 422 with the same report, so it resolves too.
   */
  importEmployees: async (input: {
    dryRun: boolean;
    rows: ImportEmployeeRow[];
  }): Promise<ImportEmployeesResult> =>
    (
      await api.post<ImportEmployeesResult>('/employees/import', input, {
        validateStatus: (s) => s === 200 || s === 422,
      })
    ).data,
  /** Live records missing a joining date, department or designation (hrbp.people read). */
  incomplete: async (): Promise<IncompleteRecord[]> =>
    (await api.get<IncompleteRecord[]>('/employees/incomplete')).data,
  get: async (id: string): Promise<Employee> =>
    (await api.get<Employee>(`/employees/${id}`)).data,
  create: async (input: CreateEmployeeInput): Promise<EmployeeWithClaim> =>
    (await api.post<EmployeeWithClaim>('/employees', input)).data,
  invite: async (input: InviteEmployeeInput): Promise<EmployeeWithClaim> =>
    (await api.post<EmployeeWithClaim>('/employees/invite', input)).data,
  update: async (id: string, input: Partial<CreateEmployeeInput>): Promise<Employee> =>
    (await api.patch<Employee>(`/employees/${id}`, input)).data,
  /** Reissue the single-use claim link for a not-yet-claimed record. */
  issueClaimLink: async (id: string): Promise<ClaimInfo> =>
    (await api.post<ClaimInfo>(`/employees/${id}/claim-link`)).data,
  /** Compensation door — pr.payroll.compensation, never hrbp.people. */
  getSalary: async (id: string): Promise<EmployeeSalary> =>
    (await api.get<EmployeeSalary>(`/employees/${id}/salary`)).data,
  updateSalary: async (id: string, input: UpdateEmployeeSalaryInput): Promise<EmployeeSalary> =>
    (await api.put<EmployeeSalary>(`/employees/${id}/salary`, input)).data,
};

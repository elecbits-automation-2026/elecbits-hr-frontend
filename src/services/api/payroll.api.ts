import type {
  AnnexureInput,
  CompensationPerson,
  CreateLoanInput,
  Loan,
  LoanDetail,
  GenerateRunResult,
  MyPayslip,
  PayrollRun,
  PayslipCorrection,
  SalaryAnnexure,
  Payslip,
  TdsEstimate,
  UpdatePayslipInput,
  UpdateTdsInput,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Fetch a PDF with the auth header and save it under the server's filename. */
const downloadPdf = async (url: string, fallbackName: string): Promise<void> => {
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
};

/**
 * Payroll runs + payslips (PR portal, pr.payroll). `/payslips/mine` is
 * me-scoped: an employee only ever sees their own, and only after a run is
 * finalized.
 */
export const payrollApi = {
  listRuns: async (): Promise<PayrollRun[]> => (await api.get<PayrollRun[]>('/payroll/runs')).data,
  createRun: async (month: string): Promise<GenerateRunResult> =>
    (await api.post<GenerateRunResult>('/payroll/runs', { month })).data,
  getRun: async (id: string): Promise<{ run: PayrollRun; payslips: Payslip[] }> =>
    (await api.get<{ run: PayrollRun; payslips: Payslip[] }>(`/payroll/runs/${id}`)).data,
  regenerate: async (id: string): Promise<GenerateRunResult> =>
    (await api.post<GenerateRunResult>(`/payroll/runs/${id}/regenerate`)).data,
  updatePayslip: async (
    runId: string,
    payslipId: string,
    input: UpdatePayslipInput,
  ): Promise<Payslip> =>
    (await api.patch<Payslip>(`/payroll/runs/${runId}/payslips/${payslipId}`, input)).data,
  finalize: async (id: string): Promise<PayrollRun> =>
    (await api.post<PayrollRun>(`/payroll/runs/${id}/finalize`)).data,
  markPaid: async (id: string): Promise<PayrollRun> =>
    (await api.post<PayrollRun>(`/payroll/runs/${id}/mark-paid`)).data,
  deleteRun: async (id: string): Promise<void> => {
    await api.delete(`/payroll/runs/${id}`);
  },
  /** Post-finalize corrections (pr.payroll). */
  corrections: async (): Promise<PayslipCorrection[]> =>
    (await api.get<PayslipCorrection[]>('/payroll/corrections')).data,
  addCorrection: async (
    payslipId: string,
    input: { amount: number; reason: string },
  ): Promise<PayslipCorrection> =>
    (await api.post<PayslipCorrection>(`/payroll/payslips/${payslipId}/corrections`, input)).data,
  cancelCorrection: async (id: string): Promise<PayslipCorrection> =>
    (await api.post<PayslipCorrection>(`/payroll/corrections/${id}/cancel`)).data,
  /** Own published payslip as a PDF. */
  downloadMyPayslip: (payslipId: string): Promise<void> =>
    downloadPdf(`/payroll/payslips/mine/${payslipId}/pdf`, 'payslip.pdf'),
  /** Any slip of a run (drafts come watermarked) — pr.payroll. */
  downloadRunPayslip: (runId: string, payslipId: string): Promise<void> =>
    downloadPdf(`/payroll/runs/${runId}/payslips/${payslipId}/pdf`, 'payslip.pdf'),
  myPayslips: async (): Promise<MyPayslip[]> =>
    (await api.get<MyPayslip[]>('/payroll/payslips/mine')).data,
  /** Compensation people list — everyone payroll may set a salary for. */
  people: async (): Promise<CompensationPerson[]> =>
    (await api.get<CompensationPerson[]>('/payroll/people')).data,
  /** TDS calculator — behind pr.payroll.compensation (shows annual CTC). */
  tdsEstimates: async (): Promise<TdsEstimate[]> =>
    (await api.get<TdsEstimate[]>('/payroll/tds')).data,
  updateTds: async (employeeId: string, input: UpdateTdsInput): Promise<TdsEstimate> =>
    (await api.patch<TdsEstimate>(`/payroll/tds/${employeeId}`, input)).data,
  /** Salary annexure (offer breakup) — pure calculator, nothing stored. */
  annexure: async (input: AnnexureInput): Promise<SalaryAnnexure> =>
    (await api.get<SalaryAnnexure>('/payroll/annexure', { params: input })).data,

  // Loans & advances (pr.payroll.compensation; own loans are me-scope).
  loans: async (): Promise<Loan[]> => (await api.get<Loan[]>('/payroll/loans')).data,
  loan: async (id: string): Promise<LoanDetail> =>
    (await api.get<LoanDetail>(`/payroll/loans/${id}`)).data,
  createLoan: async (input: CreateLoanInput): Promise<LoanDetail> =>
    (await api.post<LoanDetail>('/payroll/loans', input)).data,
  updateLoan: async (
    id: string,
    input: { interestRatePct?: number; monthsLeft?: number; note?: string },
  ): Promise<LoanDetail> => (await api.patch<LoanDetail>(`/payroll/loans/${id}`, input)).data,
  closeLoan: async (id: string, note: string): Promise<LoanDetail> =>
    (await api.post<LoanDetail>(`/payroll/loans/${id}/close`, { note })).data,
  myLoans: async (): Promise<Loan[]> => (await api.get<Loan[]>('/payroll/loans/mine')).data,
  myLoan: async (id: string): Promise<LoanDetail> =>
    (await api.get<LoanDetail>(`/payroll/loans/mine/${id}`)).data,
};

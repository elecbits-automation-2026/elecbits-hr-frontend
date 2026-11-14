import type { Payslip } from '@app-types/api.types';

export type PayslipLine = { label: string; value: number; note?: string };

/**
 * The standard Indian payslip split — the SAME lines, in the same order, as
 * the backend PDF (payroll/payslip.pdf.ts `payslipLines`): every amount sits
 * under Earnings or Deductions, so Total earnings − Total deductions = Net pay.
 * The CTC components always show; the rest only when non-zero.
 */
export const payslipLines = (slip: Payslip) => {
  const earnings: PayslipLine[] = [
    { label: 'Basic', value: slip.basic },
    { label: 'House rent allowance', value: slip.hra },
    { label: 'Leave travel allowance', value: slip.lta },
    { label: 'Special allowance', value: slip.specialAllowance },
    { label: 'Employer PF (part of CTC)', value: slip.pf },
    { label: 'Performance bonus', value: slip.performanceBonus },
    { label: 'Recognition awards (last month)', value: slip.recognitionBonus },
    { label: 'Other bonus', value: slip.otherBonus },
    {
      label: slip.exitId
        ? `Leave encashment (${slip.encashedElDays} EL days on Basic)`
        : 'Leave encashment',
      value: slip.leaveEncashment,
    },
    { label: `Gratuity (${slip.gratuityYears} years)`, value: slip.gratuity },
    { label: 'Notice pay in lieu', value: slip.noticePay },
    { label: 'Advance', value: slip.advance },
    // Only runs published before claims moved to the reimbursement sheet.
    { label: 'Reimbursement', value: slip.reimbursement },
    ...slip.corrections
      .filter((c) => c.amount > 0)
      .map((c) => ({ label: `Correction to ${c.sourceMonth}`, value: c.amount, note: c.reason })),
  ];
  const deductions: PayslipLine[] = [
    { label: 'Provident fund (employee)', value: slip.pf },
    { label: 'Provident fund (employer)', value: slip.pfEmployer },
    { label: 'Professional tax', value: slip.professionalTax },
    { label: 'Income tax (TDS)', value: slip.tds },
    { label: 'Health insurance', value: slip.healthInsurance },
    { label: 'CNPS', value: slip.cnpsEmployer },
    { label: 'Other deduction', value: slip.otherDeduction },
    {
      label: slip.exitId ? 'Loan / advance balance recovered' : 'Loan / advance EMI',
      value: slip.loanEmi,
    },
    { label: 'Notice shortfall recovered', value: slip.noticeRecovery },
    {
      label: `Sick leave without a certificate (${slip.sickLopDays} days)`,
      value: slip.sickLopDeduction,
    },
    { label: 'Recoveries (full & final)', value: slip.fnfRecovery },
    ...slip.corrections
      .filter((c) => c.amount < 0)
      .map((c) => ({ label: `Correction to ${c.sourceMonth}`, value: -c.amount, note: c.reason })),
  ];
  const keep = (rows: PayslipLine[], fixed: number) =>
    rows.filter((r, i) => i < fixed || r.value !== 0);
  const e = keep(earnings, 5);
  const d = keep(deductions, 4);
  const sum = (rows: PayslipLine[]) =>
    Math.round(rows.reduce((a, r) => a + r.value, 0) * 100) / 100;
  return { earnings: e, deductions: d, totalEarnings: sum(e), totalDeductions: sum(d) };
};

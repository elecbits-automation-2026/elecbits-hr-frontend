import type { ReimbursementClaim } from '@app-types/api.types';

/** Plain names and status chips for reimbursement claims. */
export const CATEGORY_LABELS: Record<ReimbursementClaim['category'], string> = {
  travel: 'Travel',
  food: 'Food',
  internet_phone: 'Internet / phone',
  equipment: 'Equipment',
  other: 'Other',
};

export const STATUS_LOOK: Record<ReimbursementClaim['status'], { label: string; cls: string }> = {
  pending_rm: { label: 'with manager', cls: 'bg-amber-50 text-amber-700' },
  pending_payroll: { label: 'with payroll', cls: 'bg-blue-50 text-blue-700' },
  approved: { label: 'approved — next payslip', cls: 'bg-green-50 text-green-700' },
  paid: { label: 'paid', cls: 'bg-green-100 text-green-800' },
  declined: { label: 'declined', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'withdrawn', cls: 'bg-slate-100 text-slate-500' },
};

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

import type {
  ApplicationStage,
  ApproverRole,
  BgvStatus,
  HireRole,
  CandidateSource,
  InterviewRound,
  PositionStatus,
  RequisitionStatus,
} from '@app-types/api.types';

export const ROUNDS: InterviewRound[] = ['hr', 'technical', 'practical', 'managerial', 'hr_final'];

export const ROUND_LABEL: Record<InterviewRound, string> = {
  hr: 'HR round',
  technical: 'Technical',
  practical: 'Practical (R&D / FW / HW)',
  managerial: 'Managerial',
  hr_final: 'HR final',
};

export const APPROVER_LABEL: Record<ApproverRole, string> = {
  hr_head: 'HR head',
  admin: 'Admin',
};

export const REQ_STATUS_LABEL: Record<RequisitionStatus, string> = {
  draft: 'Draft',
  queued: 'Submitted — goes for approval after the deadline',
  submitted: 'Waiting for approval',
  returned: 'Returned — edit and resubmit',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export const REQ_STATUS_CLASS: Record<RequisitionStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  queued: 'bg-violet-50 text-violet-700',
  submitted: 'bg-sky-50 text-sky-700',
  returned: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-400',
};

/** 'YYYY-Qn' for a date (calendar quarters, like review cycles). */
export const quarterOf = (d: Date): string =>
  `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;

/**
 * Plans a head can look at: the one being planned (first) and the earlier
 * ones back to this quarter — already sent, kept for returned / approved lines.
 */
export const planViewQuarters = (planQuarter: string, now = new Date()): string[] => {
  const out: string[] = [];
  for (
    let d = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    quarterOf(d) < planQuarter;
    d = new Date(d.getFullYear(), d.getMonth() + 3, 1)
  ) {
    out.unshift(quarterOf(d));
  }
  return [planQuarter, ...out];
};

/** 1200000 → '₹12,00,000'. */
export const rupees = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

/** A line's budget per hire, e.g. '₹12,00,000 – ₹18,00,000'. */
export const budgetText = (min: number | null, max: number | null): string | null =>
  min === null || max === null ? null : min === max ? rupees(min) : `${rupees(min)} – ${rupees(max)}`;

/** '2026-12-22' → '22 Dec 2026'. */
export const longDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const POSITION_STATUS_LABEL: Record<PositionStatus, string> = {
  awaiting_docs: 'waiting for JD + scorecard',
  open: 'open for sourcing',
  interviewing: 'interviewing',
  offer: 'offer out',
  filled: 'filled',
  cancelled: 'cancelled',
};

export const SOURCE_LABEL: Record<CandidateSource, string> = {
  naukri: 'Naukri',
  linkedin: 'LinkedIn',
  internshala: 'Internshala',
  careers_page: 'Careers page',
  agency: 'Agency',
  campus: 'Campus',
  social: 'Social media',
  referral: 'Referral',
  internal: 'Internal',
  other: 'Other',
};

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  sourced: 'Sourced',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  interviewed: 'All rounds scored',
  decision: 'Final decision',
  selected: 'Selected',
  offered: 'Offer out',
  hired: 'Hired',
  offer_declined: 'Declined the offer',
  offer_withdrawn: 'Offer withdrawn',
  no_show: 'Did not join',
  rejected: 'Rejected',
  withdrawn: 'Withdrew',
};

export const STAGE_CLASS: Record<ApplicationStage, string> = {
  sourced: 'bg-slate-100 text-slate-600',
  shortlisted: 'bg-violet-50 text-violet-700',
  interviewing: 'bg-sky-50 text-sky-700',
  interviewed: 'bg-emerald-50 text-emerald-700',
  decision: 'bg-amber-50 text-amber-700',
  selected: 'bg-emerald-50 text-emerald-700',
  offered: 'bg-emerald-100 text-emerald-800',
  hired: 'bg-emerald-600 text-white',
  offer_declined: 'bg-slate-100 text-slate-500',
  offer_withdrawn: 'bg-red-50 text-red-600',
  no_show: 'bg-slate-100 text-slate-500',
  rejected: 'bg-red-50 text-red-600',
  withdrawn: 'bg-slate-100 text-slate-400',
};

export const HIRE_ROLE_LABEL: Record<HireRole, string> = {
  dept_head: 'Dept head',
  ta_rm: 'TA RM',
  hr_head: 'HR head',
  admin: 'Admin',
};

export const BGV_LABEL: Record<BgvStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  clear: 'Clear',
  failed: 'Failed',
};

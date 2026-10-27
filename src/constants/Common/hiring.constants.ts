import type {
  ActivityKind,
  ActivityOutcome,
  ApplicationStage,
  ApproverRole,
  CandidateDocStatus,
  CandidateSource,
  HiringPriority,
  InterviewMode,
  InterviewRound,
  InterviewSlot,
  PositionStatus,
  RequisitionStatus,
} from '@app-types/api.types';

export const ROUNDS: InterviewRound[] = ['hr', 'technical', 'practical', 'managerial', 'hr_final'];

export const ROUND_LABEL: Record<InterviewRound, string> = {
  hr: 'Screening (TA)',
  technical: 'Technical',
  practical: 'Practical (R&D / FW / HW)',
  managerial: 'Managerial',
  hr_final: 'HR final',
};

export const APPROVER_LABEL: Record<ApproverRole, string> = {
  hrbp: 'HRBP',
};

export const PRIORITY_LABEL: Record<HiringPriority, { label: string; cls: string }> = {
  high: { label: 'High priority', cls: 'bg-red-600/10 text-red-700' },
  normal: { label: 'Normal priority', cls: 'bg-blue-600/10 text-blue-700' },
  low: { label: 'Low priority', cls: 'bg-slate-100 text-slate-600' },
};

export const EMPLOYMENT_TYPES = ['Full-time', 'Internship', 'Contract', 'Part-time'] as const;

export const REQ_STATUS_LABEL: Record<RequisitionStatus, string> = {
  draft: 'Draft',
  queued: 'Submitted — goes for approval after the deadline',
  submitted: 'Waiting for approval',
  returned: 'Returned — edit and resubmit',
  approved: 'Approved',
  cancelled: 'Cancelled',
  rejected: 'Rejected by HRBP',
};

export const REQ_STATUS_CLASS: Record<RequisitionStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  queued: 'bg-violet-50 text-violet-700',
  submitted: 'bg-sky-50 text-sky-700',
  returned: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-400',
  rejected: 'bg-red-50 text-red-700',
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
  interviewed: 'All rounds passed',
  decision: 'Offer with HR Head',
  selected: 'Offer approved',
  offered: 'Offer out',
  hired: 'Hired',
  offer_declined: 'Declined the offer',
  offer_withdrawn: 'Offer withdrawn',
  no_show: 'Did not join',
  rejected: 'Rejected',
  withdrawn: 'Withdrew',
  joined: 'Joined',
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
  joined: 'bg-green-700 text-white',
};

// ── Interview scheduling (2026-10-27) ──
export const MODE_LABEL: Record<InterviewMode, string> = {
  in_person: 'In person',
  video: 'Video call',
  phone: 'Phone call',
};

export const SLOT_STATUS_LABEL: Record<InterviewSlot['status'], string> = {
  scheduled: 'Scheduled',
  done: 'Done',
  cancelled: 'Cancelled',
  no_show: 'Did not show',
};

export const SLOT_STATUS_CLASS: Record<InterviewSlot['status'], string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  done: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-50 text-red-700',
};

/** ISO → "Tue 28 Oct, 3:00 pm" in the viewer's time. */
export const slotWhen = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

// ── Candidate contacts (workflow deck, 2026-10-27) ──
export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  call: 'Call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  meeting: 'Meeting',
};

export const ACTIVITY_OUTCOME_LABEL: Record<ActivityOutcome, string> = {
  connected: 'Connected',
  no_answer: 'No answer',
  busy: 'Busy / call back',
  wrong_number: 'Wrong number',
  other: 'Other',
};

export const DOC_STATUS_LABEL: Record<CandidateDocStatus, string> = {
  requested: 'Requested',
  received: 'Received',
  not_applicable: 'Not applicable',
};

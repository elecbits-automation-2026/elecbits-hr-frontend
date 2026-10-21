import type { Concern, ConcernOutcome, ConcernStatus, ConcernTrack } from '@app-types/api.types';

/** The four ways in — plain words first, the policy behind them second. */
export const TRACK_CHOICES: {
  key: ConcernTrack | 'posh';
  title: string;
  blurb: string;
}[] = [
  {
    key: 'dispute',
    title: 'Contest a decision',
    blurb:
      'Disagree with an appraisal, PIP, claim, probation or disciplinary decision, or how a policy was applied to you. Dispute Resolution Framework: your manager, then HR, then the Management Review Committee.',
  },
  {
    key: 'complaint',
    title: "Report someone's conduct",
    blurb:
      'Discrimination, harassment (not sexual), bullying, retaliation, or a refused accommodation — about you or something you witnessed. Handled by HR.',
  },
  {
    key: 'whistleblower',
    title: 'Report misconduct or fraud',
    blurb:
      'Fraud, corruption, breaking the law or the code of conduct, misuse of company assets, safety risks. Goes only to the whistleblower (vigil) team — not routine HR.',
  },
  {
    key: 'posh',
    title: 'Sexual harassment',
    blurb: 'Handled only by the Internal Committee under the POSH policy — not through this form.',
  },
];

export const TRACK_LABELS: Record<ConcernTrack, string> = {
  dispute: 'Dispute',
  complaint: 'Complaint',
  whistleblower: 'Whistleblower',
};

/** Mirrors the backend lists (concerns.schema.ts). */
export const CATEGORIES: Record<ConcernTrack, Record<string, string>> = {
  dispute: {
    appraisal: 'Appraisal or rating',
    pip: 'Performance improvement plan',
    reimbursement: 'Reimbursement claim',
    probation: 'Probation decision',
    discipline: 'Disciplinary action',
    referral: 'Referral bonus',
    policy_application: 'How a policy was applied',
    other: 'Something else',
  },
  complaint: {
    discrimination: 'Discrimination',
    harassment: 'Harassment (not sexual)',
    bullying: 'Bullying',
    retaliation: 'Retaliation for raising a concern',
    accommodation: 'A refused accommodation',
    other: 'Something else',
  },
  whistleblower: {
    fraud: 'Fraud',
    corruption: 'Bribery or corruption',
    violation_of_law: 'Breaking the law',
    code_of_conduct: 'Code of conduct breach',
    misuse_of_assets: 'Misuse of company assets or data',
    audit_controls: 'Accounts or audit controls',
    health_safety: 'Health or safety risk',
    retaliation: 'Retaliation against a whistleblower',
    other: 'Something else',
  },
};

export const STATUS_LABELS: Record<ConcernStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  decided: 'Decided',
  resolved: 'Resolved',
  closed: 'Closed',
  declined: 'Declined',
};

export const STATUS_CLASS: Record<ConcernStatus, string> = {
  open: 'bg-amber-50 text-amber-700',
  acknowledged: 'bg-sky-50 text-sky-700',
  investigating: 'bg-sky-50 text-sky-700',
  decided: 'bg-violet-50 text-violet-700',
  resolved: 'bg-green-50 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  declined: 'bg-red-50 text-red-700',
};

export const OUTCOME_LABELS: Record<ConcernOutcome, string> = {
  substantiated: 'Substantiated',
  partially: 'Partially substantiated',
  not_substantiated: 'Not substantiated',
  withdrawn: 'Withdrawn',
  malicious: 'Made in bad faith',
};

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Level 1 · manager',
  2: 'Level 2 · HR',
  3: 'Level 3 · Management Review Committee',
};

export const categoryLabel = (track: ConcernTrack, category: string) =>
  CATEGORIES[track][category] ?? category;

export const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** The next date the case is held to, for list rows and the case header. */
export const dueLine = (c: Concern): string | null => {
  if (['closed', 'declined', 'resolved'].includes(c.status)) return null;
  if (c.status === 'decided' && c.escalateBy) return `Escalate by ${fmtDate(c.escalateBy)}`;
  if (!c.ackAt && c.dueAckOn) return `Acknowledge by ${fmtDate(c.dueAckOn)}`;
  const due = c.extendedTo ?? c.dueResolveOn;
  return due ? `${c.extendedTo ? 'Extended to' : 'Due'} ${fmtDate(due)}` : null;
};

import type { ClearanceKind, ExitStatus } from '@app-types/api.types';

export const EXIT_STATUS_LABELS: Record<ExitStatus, string> = {
  submitted: 'Waiting for HR',
  accepted: 'Serving notice',
  relieved: 'Left — F&F pending',
  settled: 'Settled',
  withdrawn: 'Withdrawn',
  cancelled: 'Cancelled',
};

export const EXIT_STATUS_CLASS: Record<ExitStatus, string> = {
  submitted: 'bg-amber-50 text-amber-800',
  accepted: 'bg-sky-50 text-sky-700',
  relieved: 'bg-violet-50 text-violet-700',
  settled: 'bg-green-50 text-green-700',
  withdrawn: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-500',
};

export const CLEARANCE_LABELS: Record<ClearanceKind, { title: string; when: string }> = {
  hr: { title: 'HR', when: 'Exit interview, documents — from the resignation date' },
  manager: { title: 'Manager', when: 'Handover done — during notice' },
  ops: { title: 'OPS', when: 'Every asset returned — on the last working day' },
  payroll: { title: 'Payroll', when: 'Full & final — with the next monthly payroll run' },
};

/** Exit interview questions (the leaver answers on their last day). */
export const INTERVIEW_TEXT = {
  reason: 'Main reason for leaving',
  liked: 'What did you like most about working here?',
  improve: 'What should we improve?',
  managerRating: 'How was working with your manager? (1–5)',
  roleRating: 'How did you find your role? (1–5)',
  recommend: 'Would you recommend Elecbits as a place to work?',
  wouldReturn: 'Would you consider coming back?',
  newWorkplace: 'Where are you going next? (optional)',
  other: 'Anything else? (optional)',
} as const;

export const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const longDay = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export const isoToday = () => new Date().toLocaleDateString('en-CA');
export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

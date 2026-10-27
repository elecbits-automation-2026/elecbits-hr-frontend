import type {
  Application,
  ApplicationStage,
  Position,
  PositionStatus,
  Requisition,
  TaDocument,
} from '@app-types/api.types';

/** One position with its line — the unit of the Hiring board. */
export interface BoardPosition {
  line: Requisition;
  position: Position;
  apps: Application[];
}

/** Candidates still in play (the old tool's "in flight"). */
export const LIVE_STAGES: ApplicationStage[] = [
  'sourced',
  'interviewing',
  'interviewed',
  'decision',
  'selected',
  'offered',
];

/** The pipeline's columns, left to right; the closed ones sit dimmed at the end. */
export const BOARD_COLUMNS: ApplicationStage[] = [...LIVE_STAGES, 'hired', 'joined'];
export const CLOSED_STAGES: ApplicationStage[] = [
  'rejected',
  'withdrawn',
  'offer_declined',
  'offer_withdrawn',
  'no_show',
];

/** Column / card accent per stage (old tool: grey → blue → purple → amber → green). */
export const STAGE_ACCENT: Record<ApplicationStage, string> = {
  sourced: 'border-l-slate-400',
  shortlisted: 'border-l-blue-500',
  interviewing: 'border-l-violet-500',
  interviewed: 'border-l-violet-600',
  decision: 'border-l-amber-500',
  selected: 'border-l-amber-600',
  offered: 'border-l-amber-500',
  hired: 'border-l-green-600',
  joined: 'border-l-green-700',
  offer_declined: 'border-l-slate-300',
  offer_withdrawn: 'border-l-red-400',
  no_show: 'border-l-slate-300',
  rejected: 'border-l-red-500',
  withdrawn: 'border-l-slate-300',
};

export const STAGE_HEAD: Record<ApplicationStage, string> = {
  sourced: 'bg-slate-100 text-slate-600',
  shortlisted: 'bg-blue-600/10 text-blue-700',
  interviewing: 'bg-violet-600/10 text-violet-700',
  interviewed: 'bg-violet-600/10 text-violet-700',
  decision: 'bg-amber-600/10 text-amber-700',
  selected: 'bg-amber-600/10 text-amber-700',
  offered: 'bg-amber-600/10 text-amber-700',
  hired: 'bg-green-600/10 text-green-700',
  joined: 'bg-green-700/10 text-green-800',
  offer_declined: 'bg-slate-100 text-slate-500',
  offer_withdrawn: 'bg-red-600/10 text-red-700',
  no_show: 'bg-slate-100 text-slate-500',
  rejected: 'bg-red-600/10 text-red-700',
  withdrawn: 'bg-slate-100 text-slate-500',
};

export const POSITION_ACCENT: Record<PositionStatus, string> = {
  awaiting_docs: 'border-l-amber-500',
  open: 'border-l-blue-600',
  interviewing: 'border-l-violet-600',
  offer: 'border-l-amber-600',
  filled: 'border-l-green-600',
  cancelled: 'border-l-slate-300',
};

export const POSITION_PILL: Record<PositionStatus, { label: string; cls: string }> = {
  awaiting_docs: { label: 'Needs JD + scorecard', cls: 'bg-amber-600/10 text-amber-700' },
  open: { label: 'Open', cls: 'bg-blue-600/10 text-blue-700' },
  interviewing: { label: 'Interviewing', cls: 'bg-violet-600/10 text-violet-700' },
  offer: { label: 'Offer out', cls: 'bg-amber-600/10 text-amber-700' },
  filled: { label: 'Filled', cls: 'bg-green-600/10 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

/** A JD / scorecard pill: not written, draft, in review, returned, approved. */
export const docPill = (d: TaDocument | null): { label: string; cls: string } =>
  !d
    ? { label: 'not written', cls: 'bg-slate-100 text-slate-500' }
    : d.status === 'approved'
      ? { label: 'approved', cls: 'bg-green-600/10 text-green-700' }
      : d.status === 'in_review'
        ? { label: 'in review', cls: 'bg-blue-600/10 text-blue-700' }
        : d.status === 'returned'
          ? { label: 'returned', cls: 'bg-red-600/10 text-red-700' }
          : { label: 'draft', cls: 'bg-slate-100 text-slate-600' };

/** Whole days since an ISO time. */
export const daysSince = (iso: string | null): number | null =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null;

/** The quarter an ISO date falls in, e.g. "2026-Q4". */
export const quarterOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
};

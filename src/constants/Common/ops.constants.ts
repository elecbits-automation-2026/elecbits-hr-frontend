import type {
  AssetCondition,
  AssetIncidentKind,
  AssetRequestStatus,
  AssetRequestType,
  AssetStatus,
  GatePassStatus,
  StockMovementKind,
} from '@app-types/api.types';

/** OPS asset manager labels — mirror the backend enums. */

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  assigned: 'Assigned',
  idle: 'Idle',
  in_use_shared: 'In use (shared)',
  needs_repair: 'Needs repair',
  scrapped: 'Scrapped',
  gifted: 'Gifted',
  lost: 'Lost',
};

export const ASSET_STATUS_CLASS: Record<AssetStatus, string> = {
  assigned: 'bg-sky-50 text-sky-700',
  idle: 'bg-slate-100 text-slate-600',
  in_use_shared: 'bg-indigo-50 text-indigo-700',
  needs_repair: 'bg-amber-50 text-amber-800',
  scrapped: 'bg-slate-100 text-slate-400',
  gifted: 'bg-green-50 text-green-700',
  lost: 'bg-red-50 text-red-700',
};

/** Final statuses: the asset has left the register (kept, never deleted). */
export const DISPOSED: AssetStatus[] = ['scrapped', 'gifted', 'lost'];

export const CONDITION_LABELS: Record<AssetCondition, string> = {
  new: 'New',
  good: 'Good',
  fair: 'Fair',
  damaged: 'Damaged',
};

export const REQUEST_TYPE_LABELS: Record<AssetRequestType, string> = {
  new: 'New asset',
  upgrade: 'Upgrade',
  replacement: 'Replacement',
  repair: 'Repair',
  return: 'Return',
};

export const REQUEST_STATUS_LABELS: Record<AssetRequestStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  fulfilled: 'Done',
  declined: 'Declined',
};

export const REQUEST_STATUS_CLASS: Record<AssetRequestStatus, string> = {
  open: 'bg-amber-50 text-amber-800',
  in_progress: 'bg-sky-50 text-sky-700',
  fulfilled: 'bg-green-50 text-green-700',
  declined: 'bg-slate-100 text-slate-500',
};

export const PASS_STATUS_LABELS: Record<GatePassStatus, string> = {
  requested: 'Waiting for OPS',
  approved: 'Out',
  declined: 'Declined',
  returned: 'Back',
};

export const PASS_STATUS_CLASS: Record<GatePassStatus, string> = {
  requested: 'bg-amber-50 text-amber-800',
  approved: 'bg-sky-50 text-sky-700',
  declined: 'bg-slate-100 text-slate-500',
  returned: 'bg-green-50 text-green-700',
};

export const INCIDENT_KIND_LABELS: Record<AssetIncidentKind, string> = {
  damage: 'Damage',
  loss: 'Loss',
  theft: 'Theft',
};

export const STOCK_KIND_LABELS: Record<StockMovementKind, string> = {
  in: 'Stock in',
  issue: 'Issued',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  adjust: 'Adjusted',
};

/** History row kinds (asset_events.kind) in plain words. */
export const EVENT_LABELS: Record<string, string> = {
  registered: 'Registered',
  edited: 'Details edited',
  issued: 'Issued',
  returned: 'Taken back',
  transferred: 'Handed over',
  zone_changed: 'Moved zone',
  status_changed: 'Status changed',
  loan_back: 'Loan returned',
  loan_extended: 'Loan still out — new date',
  pass_requested: 'Gate pass requested',
  pass_approved: 'Gate pass approved — went out',
  pass_declined: 'Gate pass declined',
  pass_back: 'Back from gate pass',
  pass_extended: 'Gate pass still out — new date',
  incident_opened: 'Incident reported',
  incident_closed: 'Incident closed',
};

export const opsToday = () => new Date().toLocaleDateString('en-CA');

export const fmtDay = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
export const primaryBtn =
  'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40';
export const secondaryBtn =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40';
export const chipClass = 'rounded-full px-2 py-0.5 text-xs whitespace-nowrap';

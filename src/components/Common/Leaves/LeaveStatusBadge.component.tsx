import type { LeaveStatus } from '@app-types/api.types';

const STYLES: Record<LeaveStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  partially_approved: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  partially_approved: 'Partially approved',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const LeaveStatusBadge = ({ status }: { status: LeaveStatus }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
    {LABELS[status]}
  </span>
);

export default LeaveStatusBadge;

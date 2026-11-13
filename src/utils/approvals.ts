import type { LeaveRequest, WfhRequest } from '@app-types/api.types';

/**
 * The approval-slot readout (user decision): show WHO approved, by name —
 * "pending" while a slot is open, "waived" when a slot isn't part of this
 * request. ("approved" is the fallback for older rows whose approver name
 * can't be resolved.)
 */
export const leaveSlots = (l: LeaveRequest): string => {
  const rm = l.rmRequired
    ? (l.rmApprovedByName ?? (l.rmApprovedBy ? 'approved' : 'pending'))
    : 'waived';
  const hr = l.hrRequired
    ? (l.hrApprovedByName ?? (l.hrApprovedBy ? 'approved' : 'pending'))
    : (l.hrApprovedByName ?? 'waived');
  return `RM: ${rm} · HR: ${hr}`;
};

export const wfhSlots = (w: WfhRequest): string => {
  // Self-governed (nobody above them): approved as raised, neither slot used.
  if (w.status === 'approved' && !w.rmApprovedBy && !w.hrApprovedBy) {
    return 'Self-approved — no RM above';
  }
  // RM only since 2026-11-05 (HR decides only for someone with no RM).
  const by = w.rmApprovedByName ?? w.hrApprovedByName;
  if (w.status === 'approved') return by ? `Approved by ${by}` : 'Approved';
  if (w.status === 'declined' || w.status === 'cancelled') return '';
  return 'Waiting for the RM';
};

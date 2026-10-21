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
  const rm = w.rmApprovedByName ?? (w.rmApprovedBy ? 'approved' : 'pending');
  const hr = w.hrApprovedByName ?? (w.hrApprovedBy ? 'approved' : 'pending');
  return `RM: ${rm} · HR: ${hr}`;
};

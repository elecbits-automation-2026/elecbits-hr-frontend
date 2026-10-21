import type { LeaveType } from '@app-types/api.types';

/**
 * Display names for every leave type a row can carry (leave policy v1).
 * `casual` is retired — history renders it, nobody raises it.
 */
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'Sick',
  earned: 'Earned',
  menstrual: 'Menstrual',
  vacation_family: 'Vacation & family',
  compassionate: 'Compassionate',
  unpaid: 'Unpaid (LOP)',
  casual: 'Casual (retired)',
};

export const leaveTypeLabel = (type: string): string =>
  LEAVE_TYPE_LABELS[type as LeaveType] ?? type;

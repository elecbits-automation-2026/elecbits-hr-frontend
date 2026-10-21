import { useState } from 'react';

import type { LeaveRequest } from '@app-types/api.types';
import { leaveTypeLabel } from '@constants/Common/leaves/leave.constants';
import { leaveSlots } from '@utils/approvals';
import LeaveStatusBadge from './LeaveStatusBadge.component';

const dateRange = (l: LeaveRequest) =>
  l.startDate === l.endDate
    ? `${l.startDate}${l.dayPart !== 'full' ? ` (${l.dayPart === 'first_half' ? '1st half' : '2nd half'})` : ''}`
    : `${l.startDate} → ${l.endDate}`;

// Approval slots read as names: "RM: Rahul Verma · HR: pending" (user decision).

const LIVE = ['pending', 'partially_approved'];

/**
 * What the viewer's own approval slot allows on a live request: 'act' shows
 * the buttons; a string explains why there is nothing left to do here. A
 * partially-approved request must not offer Approve/Decline to the approver
 * whose slot is already filled — the backend would reject it anyway.
 */
const slotState = (l: LeaveRequest, slot: 'rm' | 'hr'): 'act' | string | null => {
  if (!LIVE.includes(l.status)) return null;
  if (slot === 'rm') {
    if (!l.rmRequired) return 'HR slot only';
    return l.rmApprovedBy ? 'you approved — awaiting HR' : 'act';
  }
  if (!l.hrRequired) return 'RM only — HR slot waived';
  return l.hrApprovedBy ? 'HR approved — awaiting RM' : 'act';
};

/**
 * One queue table for both approver surfaces (RM "Team leaves" and HR
 * "Leaves"); `slot` says which approval slot the viewer fills. Declining asks
 * for an optional reason inline — never through a browser prompt.
 */
const LeaveQueueTable = ({
  leaves,
  slot,
  onDecide,
  deciding,
}: {
  leaves: LeaveRequest[];
  slot: 'rm' | 'hr';
  onDecide: (id: string, decision: 'approve' | 'decline', reason?: string) => void;
  deciding: boolean;
}) => {
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const confirmDecline = (id: string) => {
    if (!reason.trim()) return; // declines must carry a reason (user decision)
    onDecide(id, 'decline', reason.trim());
    setDecliningId(null);
    setReason('');
  };

  if (leaves.length === 0) {
    return <p className='text-sm text-slate-500'>No leave requests here.</p>;
  }

  return (
    <table className='w-full text-left text-sm'>
      <thead>
        <tr className='border-b border-slate-200 text-xs text-slate-500'>
          <th className='py-2 pr-3 font-medium'>Employee</th>
          <th className='py-2 pr-3 font-medium'>Type</th>
          <th className='py-2 pr-3 font-medium'>Dates</th>
          <th className='py-2 pr-3 font-medium'>Days</th>
          <th className='py-2 pr-3 font-medium'>Reason</th>
          <th className='py-2 pr-3 font-medium'>Approvals</th>
          <th className='py-2 pr-3 font-medium'>Status</th>
          <th className='py-2 font-medium'>Actions</th>
        </tr>
      </thead>
      <tbody>
        {leaves.map((l) => (
          <tr key={l.id} className='border-b border-slate-100 align-top'>
            <td className='py-2 pr-3'>
              {l.employee.name}
              <span className='ml-1 font-mono text-xs text-slate-400'>
                {l.employee.employeeCode}
              </span>
            </td>
            <td className='py-2 pr-3'>{leaveTypeLabel(l.type)}</td>
            <td className='py-2 pr-3 whitespace-nowrap'>{dateRange(l)}</td>
            <td className='py-2 pr-3'>{l.days}</td>
            <td className='max-w-48 py-2 pr-3 text-slate-500'>{l.reason ?? '—'}</td>
            <td className='py-2 pr-3 whitespace-nowrap text-xs text-slate-500'>{leaveSlots(l)}</td>
            <td className='py-2 pr-3'>
              <LeaveStatusBadge status={l.status} />
            </td>
            <td className='py-2'>
              {slotState(l, slot) !== null && slotState(l, slot) !== 'act' && (
                <span className='text-xs text-slate-400'>{slotState(l, slot)}</span>
              )}
              {slotState(l, slot) === 'act' &&
                (decliningId === l.id ? (
                  <div className='flex items-center gap-2'>
                    <input
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder='Reason (required)'
                      className='w-40 rounded-md border border-slate-300 px-2 py-1 text-xs'
                    />
                    <button
                      type='button'
                      disabled={deciding || !reason.trim()}
                      onClick={() => confirmDecline(l.id)}
                      className='rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50'
                    >
                      Decline
                    </button>
                    <button
                      type='button'
                      onClick={() => setDecliningId(null)}
                      className='text-xs text-slate-400 hover:text-slate-600'
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className='flex gap-2'>
                    <button
                      type='button'
                      disabled={deciding}
                      onClick={() => onDecide(l.id, 'approve')}
                      className='rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50'
                    >
                      Approve
                    </button>
                    <button
                      type='button'
                      disabled={deciding}
                      onClick={() => {
                        setDecliningId(l.id);
                        setReason('');
                      }}
                      className='rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
                    >
                      Decline
                    </button>
                  </div>
                ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LeaveQueueTable;

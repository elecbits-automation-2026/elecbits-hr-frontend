import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LeaveBalance, LeaveRequest } from '@app-types/api.types';
import { leaveTypeLabel } from '@constants/Common/leaves/leave.constants';
import LeaveStatusBadge from '@components/Common/Leaves/LeaveStatusBadge.component';
import RaiseLeaveModal from '@components/Employee/Leaves/RaiseLeaveModal.component';
import LeaveCertificate from '@components/Employee/Leaves/LeaveCertificate.component';
import { leavesApi } from '@services/api/leaves.api';
import { apiErrorMessage } from '@utils/apiError';
import { leaveSlots } from '@utils/approvals';

const LIVE = ['pending', 'partially_approved'];
const todayStr = () => new Date().toLocaleDateString('en-CA');

/** Cancellable while live; an APPROVED leave is revocable until it starts. */
const cancellable = (l: LeaveRequest): { ok: boolean; label: string } => {
  if (LIVE.includes(l.status)) return { ok: true, label: 'Cancel' };
  if (l.status === 'approved' && l.startDate > todayStr()) return { ok: true, label: 'Revoke' };
  return { ok: false, label: '' };
};

const BalanceCard = ({ b }: { b: LeaveBalance }) => (
  <div className='rounded-xl border border-slate-200 bg-white p-4'>
    <div className='text-xs font-medium uppercase tracking-wide text-slate-400'>
      {leaveTypeLabel(b.type)}
    </div>
    <div className='mt-1 text-2xl font-semibold text-slate-800'>
      {b.remaining === null ? '∞' : b.remaining}
      {b.allocated !== null && (
        <span className='ml-1 text-sm font-normal text-slate-400'>
          / {b.allocated + b.opening}
        </span>
      )}
    </div>
    <div className='text-xs text-slate-500'>
      {b.allocated === null ? `${b.used} used · no cap` : `${b.used} used`}
      {b.type === 'earned' && b.opening > 0 && ` · ${b.opening} carried over`}
    </div>
    {b.type === 'earned' && (
      <div className='mt-1 text-[11px] text-slate-400'>
        accrues 1.5/month · balance caps at 30 · max 18 used a year
      </div>
    )}
    {b.type === 'menstrual' && (
      <div className='mt-1 text-[11px] text-slate-400'>accrues 1/month · confidential</div>
    )}
  </div>
);

const dateRange = (l: LeaveRequest) =>
  l.startDate === l.endDate
    ? `${l.startDate}${l.dayPart !== 'full' ? ` (${l.dayPart === 'first_half' ? '1st half' : '2nd half'})` : ''}`
    : `${l.startDate} → ${l.endDate}`;

/**
 * The employee's own leave surface: balances for the year, a raise door, and
 * every request they have made. Approval is dual (RM + HRBP in any order) —
 * the Approvals column shows which half is in.
 */
const MyLeavesPage = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  // Cancelling/revoking is two-step (user decision): first click arms the
  // confirmation inline, only "Yes" fires the mutation.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const balances = useQuery({ queryKey: ['leave-balances'], queryFn: () => leavesApi.balances() });
  const leaves = useQuery({ queryKey: ['my-leaves'], queryFn: leavesApi.listMine });

  const cancel = useMutation({
    mutationFn: leavesApi.cancel,
    onSettled: () => setConfirmingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>My leaves</h1>
        <button
          type='button'
          onClick={() => setShowModal(true)}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
        >
          Request leave
        </button>
      </div>

      {balances.data && (
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
          {balances.data.map((b) => (
            <BalanceCard key={b.type} b={b} />
          ))}
        </div>
      )}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {leaves.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {leaves.error && <p className='text-sm text-red-600'>{apiErrorMessage(leaves.error)}</p>}
        {cancel.error && <p className='text-sm text-red-600'>{apiErrorMessage(cancel.error)}</p>}
        {leaves.data &&
          (leaves.data.length === 0 ? (
            <p className='text-sm text-slate-500'>You have not requested any leave yet.</p>
          ) : (
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-xs text-slate-500'>
                  <th className='py-2 pr-3 font-medium'>Type</th>
                  <th className='py-2 pr-3 font-medium'>Dates</th>
                  <th className='py-2 pr-3 font-medium'>Days</th>
                  <th className='py-2 pr-3 font-medium'>Approvals</th>
                  <th className='py-2 pr-3 font-medium'>Status</th>
                  <th className='py-2 font-medium'></th>
                </tr>
              </thead>
              <tbody>
                {leaves.data.map((l) => (
                  <tr key={l.id} className='border-b border-slate-100'>
                    <td className='py-2 pr-3'>
                      {leaveTypeLabel(l.type)}
                      <LeaveCertificate leave={l} />
                    </td>
                    <td className='py-2 pr-3 whitespace-nowrap'>{dateRange(l)}</td>
                    <td className='py-2 pr-3'>{l.days}</td>
                    <td className='py-2 pr-3 text-xs text-slate-500'>
                      {leaveSlots(l)}
                      {l.status === 'declined' && l.decisionReason && (
                        <span className='ml-2 text-red-500'>({l.decisionReason})</span>
                      )}
                    </td>
                    <td className='py-2 pr-3'>
                      <LeaveStatusBadge status={l.status} />
                    </td>
                    <td className='py-2'>
                      {cancellable(l).ok &&
                        (confirmingId === l.id ? (
                          <span className='flex items-center gap-2 text-xs whitespace-nowrap'>
                            <span className='text-slate-500'>{cancellable(l).label} this leave?</span>
                            <button
                              type='button'
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(l.id)}
                              className='rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-50'
                            >
                              Yes
                            </button>
                            <button
                              type='button'
                              onClick={() => setConfirmingId(null)}
                              className='text-slate-400 hover:text-slate-600'
                            >
                              Keep it
                            </button>
                          </span>
                        ) : (
                          <button
                            type='button'
                            disabled={cancel.isPending}
                            onClick={() => setConfirmingId(l.id)}
                            className='text-xs text-slate-400 hover:text-red-600 disabled:opacity-50'
                          >
                            {cancellable(l).label}
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>

      {showModal && (
        <RaiseLeaveModal
          // What the balances say this person may raise — menstrual appears
          // only when the backend offered it.
          types={(balances.data ?? []).map((b) => b.type)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default MyLeavesPage;

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
    <div className='text-xs font-medium uppercase tracking-wide text-slate-500'>
      {leaveTypeLabel(b.type)}
    </div>
    <div className='mt-1 text-2xl font-semibold text-slate-800'>
      {b.remaining === null ? '∞' : b.remaining}
      {b.allocated !== null && (
        <span className='ml-1 text-sm font-normal text-slate-500'>/ {b.allocated + b.opening}</span>
      )}
    </div>
    <div className='text-xs text-slate-500'>
      {b.allocated === null ? `${b.used} used · no cap` : `${b.used} used`}
      {b.type === 'earned' && b.opening > 0 && ` · ${b.opening} carried over`}
    </div>
    {b.type === 'earned' && (
      <div className='mt-1 text-xs text-slate-500'>
        accrues 1.5/month · balance caps at 30 · max 18 used a year
      </div>
    )}
    {b.type === 'menstrual' && (
      <div className='mt-1 text-xs text-slate-500'>accrues 1/month · confidential</div>
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

  /** Cancel / Revoke, armed in two steps (first click asks, "Yes" fires). */
  const renderCancel = (l: LeaveRequest) => {
    const c = cancellable(l);
    if (!c.ok) return null;
    if (confirmingId === l.id) {
      return (
        <span className='flex items-center gap-2 text-xs whitespace-nowrap'>
          <span className='text-slate-600'>{c.label} this leave?</span>
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
            className='text-slate-600 hover:text-slate-800'
          >
            Keep it
          </button>
        </span>
      );
    }
    return (
      <button
        type='button'
        disabled={cancel.isPending}
        onClick={() => setConfirmingId(l.id)}
        className='rounded-md px-2 py-1 text-xs text-slate-600 hover:text-red-600 disabled:opacity-50'
      >
        {c.label}
      </button>
    );
  };

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Leave</h1>
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
        <div className='mb-3 flex items-center gap-2'>
          <h2 className='text-sm font-semibold text-slate-700'>Your requests</h2>
          {leaves.data && (
            <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'>
              {leaves.data.length}
            </span>
          )}
          {leaves.data && leaves.data.some((l) => LIVE.includes(l.status)) && (
            <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700'>
              {leaves.data.filter((l) => LIVE.includes(l.status)).length} pending
            </span>
          )}
        </div>
        {leaves.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {leaves.error && <p className='text-sm text-red-600'>{apiErrorMessage(leaves.error)}</p>}
        {cancel.error && <p className='text-sm text-red-600'>{apiErrorMessage(cancel.error)}</p>}
        {leaves.data &&
          (leaves.data.length === 0 ? (
            <p className='text-sm text-slate-500'>You have not requested any leave yet.</p>
          ) : (
            <>
              {/* Phones: one card per request, so the Cancel action stays on screen. */}
              <ul className='space-y-3 sm:hidden'>
                {leaves.data.map((l) => (
                  <li key={l.id} className='rounded-lg border border-slate-200 p-3 text-sm'>
                    <div className='flex items-start justify-between gap-2'>
                      <div>
                        <p className='font-medium text-slate-800'>{leaveTypeLabel(l.type)}</p>
                        <p className='text-slate-600'>
                          {dateRange(l)} · {l.days} day{l.days === 1 ? '' : 's'}
                        </p>
                      </div>
                      <LeaveStatusBadge status={l.status} />
                    </div>
                    <p className='mt-1 text-xs text-slate-600'>
                      {leaveSlots(l)}
                      {l.status === 'declined' && l.decisionReason && (
                        <span className='ml-2 text-red-600'>({l.decisionReason})</span>
                      )}
                    </p>
                    <div className='mt-2 flex flex-wrap items-center justify-between gap-2'>
                      <LeaveCertificate leave={l} />
                      {renderCancel(l)}
                    </div>
                  </li>
                ))}
              </ul>
              <table className='hidden w-full text-left text-sm sm:table'>
                <thead>
                  <tr className='border-b border-slate-200 text-xs text-slate-500'>
                    <th scope='col' className='py-2 pr-3 font-medium'>
                      Type
                    </th>
                    <th scope='col' className='py-2 pr-3 font-medium'>
                      Dates
                    </th>
                    <th scope='col' className='py-2 pr-3 font-medium'>
                      Days
                    </th>
                    <th scope='col' className='py-2 pr-3 font-medium'>
                      Approvals
                    </th>
                    <th scope='col' className='py-2 pr-3 font-medium'>
                      Status
                    </th>
                    <th scope='col' className='py-2 font-medium'>
                      <span className='sr-only'>Actions</span>
                    </th>
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
                      <td className='py-2 pr-3 text-xs text-slate-600'>
                        {leaveSlots(l)}
                        {l.status === 'declined' && l.decisionReason && (
                          <span className='ml-2 text-red-600'>({l.decisionReason})</span>
                        )}
                      </td>
                      <td className='py-2 pr-3'>
                        <LeaveStatusBadge status={l.status} />
                      </td>
                      <td className='py-2'>{renderCancel(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
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

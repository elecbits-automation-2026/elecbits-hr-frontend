import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ReimbursementClaim } from '@app-types/api.types';
import { reimbursementsApi } from '@services/api/reimbursements.api';
import { CATEGORY_LABELS, STATUS_LOOK, inr } from '@constants/Common/reimbursements.constants';
import { apiErrorMessage } from '@utils/apiError';

/**
 * One claim. `mode` decides the buttons: the claimant can withdraw while it
 * waits; an approver approves or declines (decline needs a reason).
 */
const ClaimRow = ({
  claim,
  mode,
  showPerson = false,
  invalidate,
}: {
  claim: ReimbursementClaim;
  mode: 'mine' | 'approver' | 'view';
  showPerson?: boolean;
  invalidate: string[][];
}) => {
  const queryClient = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const refresh = () => invalidate.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));

  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'decline') =>
      reimbursementsApi.decide(claim.id, {
        decision,
        ...(decision === 'decline' ? { reason: reason.trim() } : {}),
      }),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: () => reimbursementsApi.cancel(claim.id),
    onSuccess: refresh,
  });
  const file = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (f: File) => reimbursementsApi.uploadReceipt(claim.id, f),
    onSuccess: refresh,
  });
  const openReceipt = useMutation({ mutationFn: () => reimbursementsApi.openReceipt(claim.id) });
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload.mutate(f);
    e.target.value = '';
  };
  const look = STATUS_LOOK[claim.status];
  const canAttach = mode === 'mine' && claim.status !== 'declined' && claim.status !== 'cancelled';
  const waiting = claim.status === 'pending_rm' || claim.status === 'pending_payroll';

  return (
    <li className='rounded-lg border border-slate-100 bg-white p-3'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <span className='font-medium text-slate-800'>
          {showPerson && <span className='text-slate-500'>{claim.employee.name} · </span>}
          {claim.description}
        </span>
        <span className='flex items-center gap-2'>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${look.cls}`}>
            {claim.status === 'paid' && claim.paidInMonth
              ? `paid in ${claim.paidInMonth}`
              : look.label}
          </span>
          <span className='font-semibold tabular-nums text-slate-800'>{inr(claim.amount)}</span>
        </span>
      </div>
      <p className='mt-0.5 text-xs text-slate-400'>
        {CATEGORY_LABELS[claim.category]} · spent {claim.spentOn}
        {claim.receiptNote ? ` · receipt: ${claim.receiptNote}` : ''}
        {claim.rmDecidedByName ? ` · manager: ${claim.rmDecidedByName}` : ''}
        {claim.payrollDecidedByName ? ` · payroll: ${claim.payrollDecidedByName}` : ''}
      </p>
      {(claim.receipt || canAttach) && (
        <div className='mt-1 flex flex-wrap items-center gap-2 text-xs'>
          <input
            ref={file}
            type='file'
            accept='application/pdf,image/jpeg,image/png'
            onChange={pick}
            className='hidden'
          />
          {claim.receipt ? (
            <button
              type='button'
              onClick={() => openReceipt.mutate()}
              className='text-brand-700 hover:underline'
            >
              Receipt: {claim.receipt.fileName}
            </button>
          ) : (
            <span className='text-slate-400'>No receipt file</span>
          )}
          {canAttach && (
            <button
              type='button'
              disabled={upload.isPending}
              onClick={() => file.current?.click()}
              className='text-slate-500 hover:text-slate-800 disabled:opacity-50'
            >
              {upload.isPending ? 'Uploading…' : claim.receipt ? 'Replace' : 'Upload receipt'}
            </button>
          )}
        </div>
      )}
      {(upload.error || openReceipt.error) && (
        <p className='mt-1 text-xs text-red-600'>
          {apiErrorMessage(upload.error ?? openReceipt.error)}
        </p>
      )}
      {claim.declineReason && (
        <p className='mt-1 text-xs text-red-600'>Declined: {claim.declineReason}</p>
      )}
      {(decide.error || cancel.error) && (
        <p className='mt-1 text-xs text-red-600'>{apiErrorMessage(decide.error ?? cancel.error)}</p>
      )}
      {mode === 'mine' && waiting && (
        <button
          type='button'
          disabled={cancel.isPending}
          onClick={() => cancel.mutate()}
          className='mt-2 text-xs text-slate-500 hover:underline disabled:opacity-50'
        >
          Withdraw
        </button>
      )}
      {mode === 'approver' && waiting && !declining && (
        <div className='mt-2 flex gap-3'>
          <button
            type='button'
            disabled={decide.isPending}
            onClick={() => decide.mutate('approve')}
            className='rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50'
          >
            Approve
          </button>
          <button
            type='button'
            onClick={() => setDeclining(true)}
            className='text-xs text-red-600 hover:underline'
          >
            Decline
          </button>
        </div>
      )}
      {mode === 'approver' && declining && (
        <div className='mt-2 flex flex-wrap items-center gap-2'>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Why? (they see this)'
            className='min-w-[14rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none'
          />
          <button
            type='button'
            disabled={decide.isPending || reason.trim().length < 5}
            onClick={() => decide.mutate('decline')}
            className='rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40'
          >
            Decline
          </button>
          <button
            type='button'
            onClick={() => setDeclining(false)}
            className='text-xs text-slate-400 hover:text-slate-600'
          >
            Back
          </button>
        </div>
      )}
    </li>
  );
};

export default ClaimRow;

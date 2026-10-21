import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ReimbursementClaim } from '@app-types/api.types';
import ClaimRow from '@components/Common/Reimbursements/ClaimRow.component';
import { CATEGORY_LABELS } from '@constants/Common/reimbursements.constants';
import { reimbursementsApi } from '@services/api/reimbursements.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

const today = () => new Date().toLocaleDateString('en-CA');

/**
 * Own reimbursement claims: raise one, follow it through the manager and
 * Payroll, see the month it was paid in. Managers also see the claims waiting
 * on them here.
 */
const ReimbursementsPage = () => {
  const queryClient = useQueryClient();
  const [spentOn, setSpentOn] = useState(today());
  const [category, setCategory] = useState<ReimbursementClaim['category']>('travel');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptNote, setReceiptNote] = useState('');

  const mine = useQuery({ queryKey: ['my-reimbursements'], queryFn: reimbursementsApi.mine });
  const team = useQuery({ queryKey: ['team-reimbursements'], queryFn: reimbursementsApi.team });

  const create = useMutation({
    mutationFn: () =>
      reimbursementsApi.create({
        spentOn,
        category,
        description: description.trim(),
        amount: Number(amount),
        ...(receiptNote.trim() ? { receiptNote: receiptNote.trim() } : {}),
      }),
    onSuccess: () => {
      setDescription('');
      setAmount('');
      setReceiptNote('');
      queryClient.invalidateQueries({ queryKey: ['my-reimbursements'] });
    },
  });
  const valid = description.trim().length >= 5 && Number(amount) > 0 && spentOn <= today();

  return (
    <div className='w-full max-w-3xl space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Reimbursements</h1>

      {(team.data?.length ?? 0) > 0 && (
        <div className='rounded-xl border border-amber-200 bg-amber-50/40 p-5'>
          <h2 className='text-sm font-semibold text-slate-700'>Waiting on you</h2>
          <p className='text-xs text-slate-400'>
            Your people&rsquo;s claims. Approved, they go on to Payroll.
          </p>
          <ul className='mt-3 space-y-2'>
            {team.data!.map((c) => (
              <ClaimRow
                key={c.id}
                claim={c}
                mode='approver'
                showPerson
                invalidate={[['team-reimbursements']]}
              />
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
        className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'
      >
        <h2 className='text-sm font-semibold text-slate-700'>New claim</h2>
        <div className='grid gap-3 sm:grid-cols-3'>
          <label className='text-xs text-slate-500'>
            Spent on
            <input
              type='date'
              max={today()}
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className='text-xs text-slate-500'>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReimbursementClaim['category'])}
              className={`${inputClass} mt-1`}
            >
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className='text-xs text-slate-500'>
            Amount (₹)
            <input
              type='number'
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        <label className='block text-xs text-slate-500'>
          What was it for?
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder='e.g. Cab to the Peenya vendor visit'
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className='block text-xs text-slate-500'>
          Receipt (optional — where it is)
          <input
            value={receiptNote}
            onChange={(e) => setReceiptNote(e.target.value)}
            maxLength={300}
            placeholder='e.g. emailed to finance on 3 Oct'
            className={`${inputClass} mt-1`}
          />
        </label>
        {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}
        <div className='flex items-center justify-between gap-3'>
          <p className='text-xs text-slate-400'>
            Your manager approves first, then Payroll. Approved claims are paid with your next
            payslip.
          </p>
          <button
            type='submit'
            disabled={!valid || create.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
          >
            {create.isPending ? 'Sending…' : 'Submit claim'}
          </button>
        </div>
      </form>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>My claims</h2>
        {mine.isLoading && <p className='mt-2 text-sm text-slate-400'>Loading…</p>}
        {mine.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(mine.error)}</p>}
        {mine.data?.length === 0 && <p className='mt-2 text-sm text-slate-400'>No claims yet.</p>}
        <ul className='mt-3 space-y-2'>
          {(mine.data ?? []).map((c) => (
            <ClaimRow key={c.id} claim={c} mode='mine' invalidate={[['my-reimbursements']]} />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ReimbursementsPage;

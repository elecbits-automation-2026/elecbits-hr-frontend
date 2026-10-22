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

/** What the server accepts for a receipt (reimbursements.service RECEIPT_TYPES). */
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

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
  // The receipt file is mandatory (user decision 2026-10-22): it goes up right
  // after the claim is created; approvals are refused without it.
  const [receipt, setReceipt] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const mine = useQuery({ queryKey: ['my-reimbursements'], queryFn: reimbursementsApi.mine });
  const team = useQuery({ queryKey: ['team-reimbursements'], queryFn: reimbursementsApi.team });

  const create = useMutation({
    mutationFn: async () => {
      const claim = await reimbursementsApi.create({
        spentOn,
        category,
        description: description.trim(),
        amount: Number(amount),
        ...(receiptNote.trim() ? { receiptNote: receiptNote.trim() } : {}),
      });
      try {
        await reimbursementsApi.uploadReceipt(claim.id, receipt!);
      } catch (err) {
        throw new Error(
          `The claim was saved but the receipt didn't upload (${apiErrorMessage(err)}). Attach it from the claim below — it can't be approved without one.`,
        );
      }
      return claim;
    },
    onSuccess: () => {
      setDescription('');
      setAmount('');
      setReceiptNote('');
      setReceipt(null);
      setFileKey((k) => k + 1);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['my-reimbursements'] }),
  });
  const fileProblem =
    receipt === null
      ? null
      : !RECEIPT_TYPES.includes(receipt.type)
        ? 'Receipts must be a PDF, JPG or PNG'
        : receipt.size > RECEIPT_MAX_BYTES
          ? 'Receipts must be 10 MB or smaller'
          : null;
  const valid =
    description.trim().length >= 5 &&
    Number(amount) > 0 &&
    spentOn <= today() &&
    receipt !== null &&
    fileProblem === null;

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
          Receipt file (required — PDF, JPG or PNG, up to 10 MB)
          <input
            key={fileKey}
            type='file'
            accept={RECEIPT_TYPES.join(',')}
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            className='mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200'
          />
        </label>
        {fileProblem && <p className='text-sm text-red-600'>{fileProblem}</p>}
        <label className='block text-xs text-slate-500'>
          Note about the receipt (optional)
          <input
            value={receiptNote}
            onChange={(e) => setReceiptNote(e.target.value)}
            maxLength={300}
            placeholder='e.g. original handed to finance on 3 Oct'
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

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Payslip } from '@app-types/api.types';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * Correct a PUBLISHED payslip. The slip itself never changes: the amount
 * rides as its own line on the employee's next payslip.
 */
const CorrectionModal = ({
  slip,
  month,
  onClose,
}: {
  slip: Payslip;
  month: string;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'pay' | 'recover'>('pay');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && reason.trim().length >= 10;

  const save = useMutation({
    mutationFn: () =>
      payrollApi.addCorrection(slip.id, {
        amount: direction === 'pay' ? value : -value,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-corrections'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      onClose();
    },
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>
          Correct {slip.employee.name}&rsquo;s {month} payslip
        </h2>
        <p className='mt-1 text-xs text-slate-400'>
          The {month} payslip stays exactly as published. This amount is added as its own line on
          their next payslip, and they are notified. Adjust TDS on that draft if the correction is
          taxable.
        </p>
        <div className='mt-4 flex gap-2'>
          {(
            [
              ['pay', 'Pay them more'],
              ['recover', 'Recover an overpayment'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type='button'
              onClick={() => setDirection(k)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                direction === k
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className='mt-3 block text-xs text-slate-500'>
          Amount ({slip.currency})
          <input
            type='number'
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        <label className='mt-3 block text-xs text-slate-500'>
          Reason (the employee sees this)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder='e.g. October night-shift allowance was missed'
            className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        {save.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
        <div className='mt-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
          >
            {save.isPending ? 'Saving…' : 'Record correction'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CorrectionModal;

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PayslipCorrection } from '@app-types/api.types';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

const money = (n: number) =>
  `${n > 0 ? '+' : '−'} ${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS_LOOK: Record<PayslipCorrection['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  applied: 'bg-green-50 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

/** Every post-finalize correction; pending ones can still be cancelled. */
const CorrectionsPanel = () => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['payroll-corrections'], queryFn: payrollApi.corrections });
  const cancel = useMutation({
    mutationFn: payrollApi.cancelCorrection,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-corrections'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
  });

  if (!list.data || list.data.length === 0) return null;
  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <h2 className='text-sm font-semibold text-slate-700'>Corrections to published payslips</h2>
      <p className='mt-0.5 text-xs text-slate-400'>
        Pending ones ride on the next payroll run for that person and are marked applied when it is
        finalized.
      </p>
      {cancel.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(cancel.error)}</p>}
      <div className='mt-3 overflow-x-auto'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b border-slate-200 text-xs text-slate-500'>
              <th className='py-2 pr-3 font-medium'>Employee</th>
              <th className='py-2 pr-3 font-medium'>Corrects</th>
              <th className='py-2 pr-3 text-right font-medium'>Amount</th>
              <th className='py-2 pr-3 font-medium'>Reason</th>
              <th className='py-2 pr-3 font-medium'>Status</th>
              <th className='py-2 font-medium'></th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((c) => (
              <tr key={c.id} className='border-b border-slate-100 align-top'>
                <td className='py-2 pr-3'>{c.employee.name}</td>
                <td className='py-2 pr-3 font-mono text-xs text-slate-500'>{c.sourceMonth}</td>
                <td
                  className={`py-2 pr-3 text-right tabular-nums ${c.amount < 0 ? 'text-red-600' : 'text-green-700'}`}
                >
                  {money(c.amount)}
                </td>
                <td className='py-2 pr-3 text-slate-600'>
                  {c.reason}
                  <span className='block text-xs text-slate-400'>
                    by {c.createdByName} · {c.createdAt.slice(0, 10)}
                  </span>
                </td>
                <td className='py-2 pr-3'>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_LOOK[c.status]}`}
                  >
                    {c.status === 'applied' ? `paid in ${c.appliedMonth}` : c.status}
                  </span>
                </td>
                <td className='py-2 text-right'>
                  {c.status === 'pending' && (
                    <button
                      type='button'
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(c.id)}
                      className='text-xs text-red-600 hover:underline disabled:opacity-50'
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CorrectionsPanel;

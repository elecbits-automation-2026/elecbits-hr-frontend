import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { MyPayslip } from '@app-types/api.types';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';
import { payslipLines } from '@utils/payslipLines';
import MyLoans from '@components/Employee/Payslips/MyLoans.component';

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const amount = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className='flex justify-between gap-3 py-1 text-sm'>
    <span className={strong ? 'font-semibold text-slate-800' : 'text-slate-500'}>{label}</span>
    <span className={strong ? 'font-semibold text-slate-800' : 'text-slate-700'}>{value}</span>
  </div>
);

/**
 * One payslip, expandable to the standard layout — the same Earnings |
 * Deductions split, totals and net pay as the PDF (utils/payslipLines).
 */
const PayslipCard = ({ slip }: { slip: MyPayslip }) => {
  const [open, setOpen] = useState(false);
  const download = useMutation({ mutationFn: () => payrollApi.downloadMyPayslip(slip.id) });
  const lines = payslipLines(slip);
  return (
    <div className='rounded-xl border border-slate-200 bg-white'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='flex w-full items-center justify-between px-5 py-4 text-left'
      >
        <span className='font-medium text-slate-800'>{slip.month}</span>
        <span className='flex items-center gap-3'>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              slip.runStatus === 'paid' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {slip.runStatus}
          </span>
          <span className='font-semibold text-slate-800'>
            {money(slip.finalPay, slip.currency)}
          </span>
          <span className='text-xs text-slate-400'>{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open && (
        <div className='grid grid-cols-1 gap-4 border-t border-slate-100 px-5 py-4 sm:grid-cols-2'>
          <div className='flex flex-wrap items-center justify-between gap-3 sm:col-span-2'>
            <div className='flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500'>
              <span>
                Working days <b className='text-slate-700'>{slip.workingDays}</b>
              </span>
              <span>
                Days paid <b className='text-slate-700'>{Math.max(0, 30 - slip.lopDays)}</b> of
                30
              </span>
              <span>
                Loss of pay <b className='text-slate-700'>{slip.lopDays}</b> days
              </span>
              {slip.autoElDays > 0 && (
                <span>
                  Covered by earned leave <b className='text-slate-700'>{slip.autoElDays}</b>{' '}
                  days
                </span>
              )}
            </div>
            <div className='flex items-center gap-3'>
              {download.error && (
                <span className='text-xs text-red-600'>{apiErrorMessage(download.error)}</span>
              )}
              <button
                type='button'
                disabled={download.isPending}
                onClick={() => download.mutate()}
                className='rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'
              >
                {download.isPending ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          </div>
          {(
            [
              ['Earnings', lines.earnings, 'Total earnings', lines.totalEarnings],
              ['Deductions', lines.deductions, 'Total deductions', lines.totalDeductions],
            ] as const
          ).map(([title, rows, totalLabel, total]) => (
            <div key={title} className='flex flex-col rounded-lg border border-slate-200'>
              <div className='flex justify-between rounded-t-lg bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>
                <span>{title}</span>
                <span>{slip.currency}</span>
              </div>
              <div className='flex-1 px-3 py-1'>
                {rows.map((r) => (
                  <div key={r.label + (r.note ?? '')}>
                    <Line label={r.label} value={amount(r.value)} />
                    {r.note && <p className='-mt-1 pb-1 text-xs text-slate-400'>{r.note}</p>}
                    {r.label === 'Reimbursement' &&
                      slip.reimbursementClaims.map((c) => (
                        <p key={c.id} className='-mt-1 pb-1 pl-3 text-xs text-slate-400'>
                          {c.spentOn} · {c.description} · {money(c.amount, slip.currency)}
                        </p>
                      ))}
                  </div>
                ))}
              </div>
              <div className='rounded-b-lg border-t border-slate-200 bg-slate-50 px-3'>
                <Line label={totalLabel} value={amount(total)} strong />
              </div>
            </div>
          ))}
          <div className='flex flex-wrap items-baseline justify-between gap-2 rounded-lg border-l-4 border-brand-600 bg-blue-50 px-4 py-3 sm:col-span-2'>
            <span className='font-semibold text-slate-800'>Net pay for {slip.month}</span>
            <span className='text-xl font-semibold text-brand-600'>
              {money(slip.finalPay, slip.currency)}
            </span>
          </div>
          {(slip.lopDays > 0 || slip.pf > 0) && (
            <div className='space-y-1 text-xs text-slate-400 sm:col-span-2'>
              {slip.lopDays > 0 && (
                <p>
                  Monthly CTC {money(slip.monthlyGross, slip.currency)} less loss of pay{' '}
                  {money(slip.lopAmount, slip.currency)} ({slip.lopDays} of 30 days).
                </p>
              )}
              {slip.pf > 0 && (
                <p>
                  Your CTC includes the employer’s PF share, so it shows under Earnings and is
                  deposited to your PF account under Deductions.
                </p>
              )}
            </div>
          )}
          {slip.correctedBy.some((c) => c.status !== 'cancelled') && (
            <div className='rounded-lg bg-amber-50 p-3 text-xs text-amber-800 sm:col-span-2'>
              <p className='font-medium'>This payslip was corrected afterwards</p>
              {slip.correctedBy
                .filter((c) => c.status !== 'cancelled')
                .map((c) => (
                  <p key={c.id} className='mt-1'>
                    {c.amount < 0 ? '−' : '+'} {money(Math.abs(c.amount), slip.currency)} —{' '}
                    {c.reason}{' '}
                    <span className='text-amber-600'>
                      (
                      {c.status === 'applied'
                        ? `paid in ${c.appliedMonth}`
                        : 'on your next payslip'}
                      )
                    </span>
                  </p>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Own published payslips — nothing shows until PR finalizes a run. */
const MyPayslipsPage = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: payrollApi.myPayslips,
  });

  return (
    <div className='w-full max-w-3xl space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Pay</h1>
      <MyLoans />
      {isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {error && <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>}
      {data &&
        (data.length === 0 ? (
          <p className='text-sm text-slate-500'>
            No payslips yet — they appear here once Payroll publishes a month.
          </p>
        ) : (
          data.map((slip) => <PayslipCard key={slip.id} slip={slip} />)
        ))}
    </div>
  );
};

export default MyPayslipsPage;

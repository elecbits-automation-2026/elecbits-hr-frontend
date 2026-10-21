import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { MyPayslip } from '@app-types/api.types';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';
import MyLoans from '@components/Employee/Payslips/MyLoans.component';

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className='flex justify-between py-1 text-sm'>
    <span className='text-slate-500'>{label}</span>
    <span className={strong ? 'font-semibold text-slate-800' : 'text-slate-700'}>{value}</span>
  </div>
);

/** One payslip, expandable to the full earning/deduction breakdown. */
const PayslipCard = ({ slip }: { slip: MyPayslip }) => {
  const [open, setOpen] = useState(false);
  const download = useMutation({ mutationFn: () => payrollApi.downloadMyPayslip(slip.id) });
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
        <div className='grid grid-cols-1 gap-6 border-t border-slate-100 px-5 py-4 sm:grid-cols-2'>
          <div className='flex items-center justify-end gap-3 sm:col-span-2'>
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
          <div>
            <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400'>
              Earnings
            </p>
            <Line label={`Basic (${slip.basicPercent}%)`} value={money(slip.basic, slip.currency)} />
            <Line label={`HRA (${slip.hraPercent}%)`} value={money(slip.hra, slip.currency)} />
            <Line label='LTA' value={money(slip.lta, slip.currency)} />
            <Line label='Special allowance' value={money(slip.specialAllowance, slip.currency)} />
            <Line label='Monthly CTC' value={money(slip.monthlyGross, slip.currency)} />
            {slip.autoElDays > 0 && (
              <Line label='Absence covered by earned leave' value={`${slip.autoElDays} days`} />
            )}
            {slip.lopDays > 0 && (
              <Line
                label={`Loss of pay (${slip.lopDays} of 30 days)`}
                value={`− ${money(slip.lopAmount, slip.currency)}`}
              />
            )}
            <Line
              label='Salary for the month'
              value={money(slip.earningsTotal, slip.currency)}
              strong
            />
            {(slip.reimbursement > 0 ||
              slip.performanceBonus > 0 ||
              slip.recognitionBonus > 0 ||
              slip.otherBonus > 0 ||
              slip.leaveEncashment > 0 ||
              slip.advance > 0 ||
              slip.corrections.length > 0) && (
              <>
                {slip.reimbursement > 0 && (
                  <Line
                    label='Reimbursement'
                    value={`+ ${money(slip.reimbursement, slip.currency)}`}
                  />
                )}
                {slip.reimbursementClaims.map((c) => (
                  <p key={c.id} className='-mt-1 pb-1 pl-3 text-xs text-slate-400'>
                    {c.spentOn} · {c.description} · {money(c.amount, slip.currency)}
                  </p>
                ))}
                {slip.performanceBonus > 0 && (
                  <Line
                    label='Performance bonus'
                    value={`+ ${money(slip.performanceBonus, slip.currency)}`}
                  />
                )}
                {slip.recognitionBonus > 0 && (
                  <Line
                    label='Recognition awards (last month)'
                    value={`+ ${money(slip.recognitionBonus, slip.currency)}`}
                  />
                )}
                {slip.otherBonus > 0 && (
                  <Line label='Other bonus' value={`+ ${money(slip.otherBonus, slip.currency)}`} />
                )}
                {slip.leaveEncashment > 0 && (
                  <Line
                    label='Leave encashment'
                    value={`+ ${money(slip.leaveEncashment, slip.currency)}`}
                  />
                )}
                {slip.advance > 0 && (
                  <Line label='Advance' value={`+ ${money(slip.advance, slip.currency)}`} />
                )}
                {slip.corrections.map((c) => (
                  <div key={c.id}>
                    <Line
                      label={`Correction to ${c.sourceMonth}`}
                      value={`${c.amount < 0 ? '−' : '+'} ${money(Math.abs(c.amount), slip.currency)}`}
                    />
                    <p className='-mt-1 pb-1 text-xs text-slate-400'>{c.reason}</p>
                  </div>
                ))}
              </>
            )}
          </div>
          <div>
            <p className='mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400'>
              Deductions
            </p>
            <Line label='Provident fund (employee)' value={money(slip.pf, slip.currency)} />
            <Line label='Provident fund (employer)' value={money(slip.pfEmployer, slip.currency)} />
            <Line label='TDS' value={money(slip.tds, slip.currency)} />
            <Line label='Professional tax' value={money(slip.professionalTax, slip.currency)} />
            {slip.healthInsurance > 0 && (
              <Line label='Health insurance' value={money(slip.healthInsurance, slip.currency)} />
            )}
            {slip.cnpsEmployer > 0 && (
              <Line label='CNPS' value={money(slip.cnpsEmployer, slip.currency)} />
            )}
            <Line label='Other deduction' value={money(slip.otherDeduction, slip.currency)} />
            <Line label='Total deductions' value={money(slip.deductionsTotal, slip.currency)} />
            <Line label='Net pay' value={money(slip.netPay, slip.currency)} />
            {slip.loanEmi > 0 && (
              <Line
                label={slip.exitId ? 'Loan / advance balance' : 'Loan / advance EMI'}
                value={`− ${money(slip.loanEmi, slip.currency)}`}
              />
            )}
            <Line label='Final pay' value={money(slip.finalPay, slip.currency)} strong />
          </div>
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
      <h1 className='text-2xl font-semibold text-slate-800'>My payslips</h1>
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

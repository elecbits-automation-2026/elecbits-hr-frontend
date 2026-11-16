import { useQueries, useQuery } from '@tanstack/react-query';

import type { PayrollRun } from '@app-types/api.types';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

interface MonthTotals {
  run: PayrollRun;
  people: number;
  pfEmployee: number;
  pfEmployer: number;
  pt: number;
  tds: number;
}

const COLUMNS: Array<[keyof Omit<MonthTotals, 'run' | 'people'>, string]> = [
  ['pfEmployee', 'PF (employee)'],
  ['pfEmployer', 'PF (employer)'],
  ['pt', 'Professional tax'],
  ['tds', 'TDS'],
];

const pfTotal = (m: Pick<MonthTotals, 'pfEmployee' | 'pfEmployer'>) => m.pfEmployee + m.pfEmployer;
const total = (m: Omit<MonthTotals, 'run' | 'people'>) => pfTotal(m) + m.pt + m.tds;

const STATUS: Record<PayrollRun['status'], string> = {
  draft: 'Draft — may change',
  finalized: 'Finalised',
  paid: 'Paid',
};

/**
 * Payroll → Statutory (learner, 2026-11-16): what each month's payslips hold
 * back for PF (both sides), professional tax and TDS — the numbers the
 * challans are filed for. Sums of the payslips themselves; a draft month is
 * shown but kept out of the totals. Filing status is not tracked here.
 */
const StatutoryPanel = () => {
  const runs = useQuery({ queryKey: ['payroll-runs'], queryFn: payrollApi.listRuns });
  const last12 = [...(runs.data ?? [])].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
  const details = useQueries({
    queries: last12.map((r) => ({
      queryKey: ['payroll-run', r.id],
      queryFn: () => payrollApi.getRun(r.id),
      staleTime: 5 * 60_000,
    })),
  });

  if (runs.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (runs.error) return <p className='text-sm text-red-600'>{apiErrorMessage(runs.error)}</p>;
  if (last12.length === 0) {
    return <p className='text-sm text-slate-500'>No payroll runs yet.</p>;
  }
  if (details.some((d) => d.isLoading)) return <p className='text-sm text-slate-500'>Loading…</p>;

  const months: MonthTotals[] = last12.map((run, i) => {
    const slips = details[i]?.data?.payslips ?? [];
    return {
      run,
      people: slips.length,
      pfEmployee: slips.reduce((n, s) => n + s.pf, 0),
      pfEmployer: slips.reduce((n, s) => n + s.pfEmployer, 0),
      pt: slips.reduce((n, s) => n + s.professionalTax, 0),
      tds: slips.reduce((n, s) => n + s.tds, 0),
    };
  });
  const closed = months.filter((m) => m.run.status !== 'draft');
  const sum = {
    pfEmployee: closed.reduce((n, m) => n + m.pfEmployee, 0),
    pfEmployer: closed.reduce((n, m) => n + m.pfEmployer, 0),
    pt: closed.reduce((n, m) => n + m.pt, 0),
    tds: closed.reduce((n, m) => n + m.tds, 0),
  };

  const downloadCsv = () => {
    const rows = [
      [
        'Month',
        'Status',
        'Payslips',
        'PF employee',
        'PF employer',
        'PF total',
        'PT',
        'TDS',
        'Total',
      ],
      ...months.map((m) => [
        m.run.month,
        m.run.status,
        m.people,
        m.pfEmployee,
        m.pfEmployer,
        pfTotal(m),
        m.pt,
        m.tds,
        total(m),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'statutory-totals.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-slate-500'>
          What each month&rsquo;s payslips hold back — the amounts the PF, PT and TDS challans are
          filed for. Draft months are shown but left out of the totals.
        </p>
        <button
          type='button'
          onClick={downloadCsv}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
        >
          Download CSV
        </button>
      </div>
      <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white'>
        <table className='w-full min-w-[52rem] text-left text-sm'>
          <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
            <tr>
              <th className='px-4 py-3'>Month</th>
              <th className='px-4 py-3'>Status</th>
              <th className='px-4 py-3 text-right'>Payslips</th>
              {COLUMNS.map(([k, label]) => (
                <th key={k} className='px-4 py-3 text-right'>
                  {label}
                </th>
              ))}
              <th className='px-4 py-3 text-right'>PF total</th>
              <th className='px-4 py-3 text-right'>All statutory</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const draft = m.run.status === 'draft';
              return (
                <tr
                  key={m.run.id}
                  className={`border-t border-slate-100 tabular-nums ${draft ? 'italic text-slate-400' : 'text-slate-700'}`}
                >
                  <td className='px-4 py-3 not-italic'>{monthLabel(m.run.month)}</td>
                  <td className='px-4 py-3 text-xs'>{STATUS[m.run.status]}</td>
                  <td className='px-4 py-3 text-right'>{m.people}</td>
                  {COLUMNS.map(([k]) => (
                    <td key={k} className='px-4 py-3 text-right'>
                      {money(m[k])}
                    </td>
                  ))}
                  <td className='px-4 py-3 text-right'>{money(pfTotal(m))}</td>
                  <td className='px-4 py-3 text-right font-medium'>{money(total(m))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className='border-t-2 border-slate-300 bg-slate-50 font-semibold tabular-nums text-slate-800'>
              <td className='px-4 py-3' colSpan={3}>
                Total, {closed.length} finalised / paid month{closed.length === 1 ? '' : 's'}
              </td>
              {COLUMNS.map(([k]) => (
                <td key={k} className='px-4 py-3 text-right'>
                  {money(sum[k])}
                </td>
              ))}
              <td className='px-4 py-3 text-right'>{money(pfTotal(sum))}</td>
              <td className='px-4 py-3 text-right'>{money(total(sum))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className='text-xs text-slate-500'>
        The last 12 runs. ESIC is not part of this payroll, so it has no column. Filing status
        (challan paid or not) is not tracked here.
      </p>
    </div>
  );
};

export default StatutoryPanel;

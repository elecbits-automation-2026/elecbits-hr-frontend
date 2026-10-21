import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TdsEstimate } from '@app-types/api.types';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

const money = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * The ERP sheet's TDS tab from live data: FY-prorated new-regime tax per
 * employee, what's already been deducted in published slips, and the revised
 * monthly TDS to apply forward. "Apply" writes employee_salary.tds_amount —
 * the number every new draft run picks up.
 */
const TdsCalculator = () => {
  const queryClient = useQueryClient();
  const [cnpsDraft, setCnpsDraft] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll-tds'],
    queryFn: payrollApi.tdsEstimates,
  });

  const update = useMutation({
    mutationFn: ({ employeeId, input }: { employeeId: string; input: { tdsAmount?: number; cnpsPercent?: number } }) =>
      payrollApi.updateTds(employeeId, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['payroll-tds'] }),
  });

  const commitCnps = (row: TdsEstimate) => {
    const draft = cnpsDraft[row.employee.id];
    if (draft === undefined || Number(draft) === row.cnpsPercent) return;
    update.mutate({ employeeId: row.employee.id, input: { cnpsPercent: Number(draft) } });
    setCnpsDraft((d) => {
      const { [row.employee.id]: _, ...rest } = d;
      void _;
      return rest;
    });
  };

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <p className='mb-3 text-xs text-slate-400'>
        New-regime slabs with 4% cess on FY-prorated CTC, less the ₹75,000 standard deduction,
        employer PF (₹1,800/month) and CNPS (CNPS% of the 50% basic share). Marginal relief
        applies just above the ₹12L rebate line — tax never exceeds the income above it. “Apply”
        writes the revised monthly TDS onto the salary record — every new draft run picks it up.
      </p>
      {isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {error && <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>}
      {update.error && <p className='text-sm text-red-600'>{apiErrorMessage(update.error)}</p>}
      {data && (
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-slate-200 text-xs text-slate-500'>
                <th className='py-2 pr-3 font-medium'>Employee</th>
                <th className='py-2 pr-3 text-right font-medium'>CTC</th>
                <th className='py-2 pr-3 text-right font-medium' title='(FY close − joining)/30, capped 12'>
                  FY months
                </th>
                <th className='py-2 pr-3 text-right font-medium'>CNPS %</th>
                <th className='py-2 pr-3 text-right font-medium' title='FY share of the annual variable-pay target — taxable'>
                  Variable
                </th>
                <th className='py-2 pr-3 text-right font-medium'>Taxable</th>
                <th className='py-2 pr-3 text-right font-medium' title='(Slab tax + surcharge above ₹50L) × 1.04 cess; nil up to 12L, marginal relief at every line'>
                  Total tax
                </th>
                <th className='py-2 pr-3 text-right font-medium'>TDS/month</th>
                <th className='py-2 pr-3 text-right font-medium' title='In published slips this FY'>
                  Deducted
                </th>
                <th className='py-2 pr-3 text-right font-medium' title='(total − deducted) ÷ months left'>
                  Revised/mo
                </th>
                <th className='py-2 pr-3 text-right font-medium'>Current</th>
                <th className='py-2 font-medium'></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const stale = Math.abs(r.currentTdsAmount - r.revisedTdsPerMonth) >= 1;
                return (
                  <tr key={r.employee.id} className='border-b border-slate-100'>
                    <td className='py-2 pr-3'>
                      {r.employee.name}
                      <span className='ml-1 font-mono text-xs text-slate-400'>
                        {r.employee.employeeCode}
                      </span>
                    </td>
                    <td className='py-2 pr-3 text-right'>{money(r.ctc)}</td>
                    <td className='py-2 pr-3 text-right'>{r.fyMonths}</td>
                    <td className='py-2 pr-3 text-right'>
                      <input
                        type='number'
                        min={0}
                        max={100}
                        step='0.5'
                        value={cnpsDraft[r.employee.id] ?? String(r.cnpsPercent)}
                        onChange={(e) =>
                          setCnpsDraft((d) => ({ ...d, [r.employee.id]: e.target.value }))
                        }
                        onBlur={() => commitCnps(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className='w-16 rounded-md border border-slate-200 px-1 py-0.5 text-right text-sm'
                      />
                    </td>
                    <td className='py-2 pr-3 text-right text-slate-500'>
                      {r.fyVariablePay > 0 ? money(r.fyVariablePay) : '—'}
                    </td>
                    <td className='py-2 pr-3 text-right'>{money(r.taxableIncome)}</td>
                    <td className='py-2 pr-3 text-right'>
                      {r.totalTax === 0 ? (
                        <span className='text-green-600' title='Within the 12L rebate'>
                          nil
                        </span>
                      ) : (
                        <span title={r.surcharge > 0 ? `incl. surcharge ${money(r.surcharge)}` : undefined}>
                          {money(r.totalTax)}
                          {r.surcharge > 0 && <span className='ml-1 text-xs text-amber-600'>+SC</span>}
                        </span>
                      )}
                    </td>
                    <td className='py-2 pr-3 text-right'>{money(r.tdsPerMonth)}</td>
                    <td className='py-2 pr-3 text-right'>{money(r.tdsAlreadyDeducted)}</td>
                    <td className='py-2 pr-3 text-right font-medium'>
                      {money(r.revisedTdsPerMonth)}
                    </td>
                    <td className={`py-2 pr-3 text-right ${stale ? 'text-amber-600' : 'text-slate-500'}`}>
                      {money(r.currentTdsAmount)}
                    </td>
                    <td className='py-2 text-right'>
                      {stale && (
                        <button
                          type='button'
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              employeeId: r.employee.id,
                              input: { tdsAmount: r.revisedTdsPerMonth },
                            })
                          }
                          className='rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50'
                        >
                          Apply ₹{money(r.revisedTdsPerMonth)}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TdsCalculator;

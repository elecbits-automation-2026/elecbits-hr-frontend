import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { LoanSchedule } from '@components/Pr/LoansPanel.component';
import { payrollApi } from '@services/api/payroll.api';

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** My payslips: own loans / advances, the EMI and what is left. */
const MyLoans = () => {
  const loans = useQuery({ queryKey: ['my-loans'], queryFn: payrollApi.myLoans });
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ['my-loan', openId],
    queryFn: () => payrollApi.myLoan(openId!),
    enabled: openId !== null,
  });
  const list = loans.data ?? [];
  if (list.length === 0) return null;
  return (
    <section className='space-y-2 rounded-xl border border-slate-200 bg-white p-5'>
      <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
        Loans and advances
      </h2>
      <ul className='space-y-2'>
        {list.map((l) => (
          <li key={l.id} className='rounded-lg border border-slate-100'>
            <button
              type='button'
              onClick={() => setOpenId(openId === l.id ? null : l.id)}
              className='flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left text-sm'
            >
              <span className='font-medium text-slate-800'>
                {l.kind === 'advance' ? 'Salary advance' : 'Loan'} {money(l.principal)}
              </span>
              <span className='text-xs text-slate-500'>
                {l.interestRatePct}% · {l.months} mo from {l.startMonth}
                {l.status !== 'active' ? ` · ${l.status === 'closed' ? 'closed' : 'recovered in F&F'}` : ''}
              </span>
              <span className='ml-auto text-xs text-slate-600'>
                EMI {money(l.emi)} · left <b>{money(l.balance)}</b>
              </span>
            </button>
            {openId === l.id && detail.data && (
              <div className='border-t border-slate-100 p-3'>
                <LoanSchedule loan={detail.data} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MyLoans;

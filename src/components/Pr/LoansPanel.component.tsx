import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Loan, LoanDetail } from '@app-types/api.types';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none';
const nextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toLocaleDateString('en-CA').slice(0, 7);
};

const STATUS: Record<Loan['status'], { label: string; cls: string }> = {
  active: { label: 'active', cls: 'bg-blue-50 text-blue-700' },
  closed: { label: 'closed', cls: 'bg-slate-100 text-slate-500' },
  recovered_at_exit: { label: 'recovered in F&F', cls: 'bg-violet-50 text-violet-700' },
};

/** Repayments so far and the schedule ahead for one loan. */
export const LoanSchedule = ({ loan }: { loan: LoanDetail }) => (
  <div className='grid gap-4 text-xs sm:grid-cols-2'>
    <div>
      <p className='mb-1 font-semibold uppercase tracking-wide text-slate-400'>Paid</p>
      {loan.repayments.length === 0 ? (
        <p className='text-slate-400'>Nothing yet.</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {loan.repayments.map((r, i) => (
              <tr key={i} className='border-b border-slate-100'>
                <td className='py-1'>{r.month ?? r.at.slice(0, 10)}</td>
                <td className='py-1 text-slate-400'>
                  {r.kind === 'fnf' ? 'F&F' : r.kind === 'outside' ? 'closed early' : 'EMI'}
                </td>
                <td className='py-1 text-right tabular-nums'>{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    <div>
      <p className='mb-1 font-semibold uppercase tracking-wide text-slate-400'>Ahead</p>
      {loan.schedule.length === 0 ? (
        <p className='text-slate-400'>Nothing left.</p>
      ) : (
        <table className='w-full'>
          <thead className='text-slate-400'>
            <tr>
              <th className='py-1 text-left font-medium'>Month</th>
              <th className='py-1 text-right font-medium'>EMI</th>
              <th className='py-1 text-right font-medium'>Interest</th>
              <th className='py-1 text-right font-medium'>Balance after</th>
            </tr>
          </thead>
          <tbody>
            {loan.schedule.map((s) => (
              <tr key={s.month} className='border-b border-slate-100'>
                <td className='py-1'>{s.month}</td>
                <td className='py-1 text-right tabular-nums'>{money(s.amount)}</td>
                <td className='py-1 text-right tabular-nums text-slate-400'>{money(s.interest)}</td>
                <td className='py-1 text-right tabular-nums'>{money(s.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

/** One loan opened in the register: schedule, re-price, close early. */
const LoanRow = ({ loan, open, onToggle }: { loan: Loan; open: boolean; onToggle: () => void }) => {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['payroll-loan', loan.id],
    queryFn: () => payrollApi.loan(loan.id),
    enabled: open,
  });
  const [rate, setRate] = useState(String(loan.interestRatePct));
  const [monthsLeft, setMonthsLeft] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['payroll-loans'] });
    void queryClient.invalidateQueries({ queryKey: ['payroll-loan', loan.id] });
  };
  const update = useMutation({
    mutationFn: () =>
      payrollApi.updateLoan(loan.id, {
        interestRatePct: Number(rate),
        ...(monthsLeft ? { monthsLeft: Number(monthsLeft) } : {}),
      }),
    onSuccess: () => {
      setMonthsLeft('');
      refresh();
    },
  });
  const close = useMutation({
    mutationFn: () => payrollApi.closeLoan(loan.id, closeNote.trim()),
    onSuccess: refresh,
  });
  const look = STATUS[loan.status];
  return (
    <li className='rounded-lg border border-slate-200 bg-white'>
      <button
        type='button'
        onClick={onToggle}
        className='flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm'
      >
        <span className='font-medium text-slate-800'>{loan.employee.name}</span>
        <span className='text-xs text-slate-400'>{loan.employee.employeeCode}</span>
        <span className='text-xs text-slate-500'>
          {loan.kind === 'advance' ? 'Advance' : 'Loan'} {money(loan.principal)} ·{' '}
          {loan.interestRatePct}% · {loan.months} mo from {loan.startMonth}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${look.cls}`}>{look.label}</span>
        <span className='ml-auto text-xs text-slate-600'>
          EMI {money(loan.emi)} · balance <b>{money(loan.balance)}</b>
        </span>
      </button>
      {open && (
        <div className='space-y-3 border-t border-slate-100 p-4'>
          {loan.note && <p className='text-xs text-slate-500'>Note: {loan.note}</p>}
          {detail.data && <LoanSchedule loan={detail.data} />}
          {loan.status === 'active' && (
            <div className='flex flex-wrap items-end gap-3 text-xs text-slate-600'>
              <label>
                Interest % / yr
                <input
                  type='number'
                  min={0}
                  max={50}
                  step={0.25}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className={`${inputClass} w-24`}
                />
              </label>
              <label>
                Months left (optional)
                <input
                  type='number'
                  min={1}
                  max={120}
                  value={monthsLeft}
                  onChange={(e) => setMonthsLeft(e.target.value)}
                  className={`${inputClass} w-28`}
                />
              </label>
              <button
                type='button'
                disabled={update.isPending}
                onClick={() => update.mutate()}
                className='rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-500 disabled:opacity-40'
              >
                Re-work the EMI
              </button>
              <label className='min-w-[14rem] flex-1'>
                Close early (paid outside payroll)
                <input
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder='e.g. paid by bank transfer on 12 Nov'
                  className={inputClass}
                />
              </label>
              <button
                type='button'
                disabled={closeNote.trim().length < 3 || close.isPending}
                onClick={() => close.mutate()}
                className='rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white hover:bg-slate-600 disabled:opacity-40'
              >
                Close loan
              </button>
            </div>
          )}
          {(detail.error || update.error || close.error) && (
            <p className='text-xs text-red-600'>
              {apiErrorMessage(detail.error ?? update.error ?? close.error)}
            </p>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * The loan / advance register. Payroll records each one (no application);
 * the EMI comes off every payslip from the start month, and whatever is left
 * is recovered in the full & final.
 */
const LoansPanel = () => {
  const queryClient = useQueryClient();
  const loans = useQuery({ queryKey: ['payroll-loans'], queryFn: payrollApi.loans });
  const people = useQuery({ queryKey: ['payroll-tds'], queryFn: payrollApi.tdsEstimates });
  const [openId, setOpenId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    kind: 'loan' as Loan['kind'],
    principal: '',
    interestRatePct: '0',
    months: '12',
    startMonth: nextMonth(),
    note: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  const create = useMutation({
    mutationFn: () =>
      payrollApi.createLoan({
        employeeId: form.employeeId,
        kind: form.kind,
        principal: Number(form.principal),
        interestRatePct: Number(form.interestRatePct) || 0,
        months: form.kind === 'advance' ? 1 : Number(form.months),
        startMonth: form.startMonth,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      }),
    onSuccess: (loan) => {
      setForm({ ...form, employeeId: '', principal: '', note: '' });
      setOpenId(loan.id);
      void queryClient.invalidateQueries({ queryKey: ['payroll-loans'] });
    },
  });
  const list = (loans.data ?? []).filter((l) => showClosed || l.status === 'active');
  const ready =
    !!form.employeeId &&
    Number(form.principal) > 0 &&
    /^\d{4}-\d{2}$/.test(form.startMonth) &&
    (form.kind === 'advance' || Number(form.months) >= 1);

  return (
    <div className='space-y-4'>
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>Record a loan or advance</h2>
        <p className='mt-1 text-xs text-slate-400'>
          Confirmed full-time employees only. An advance is recovered in one month. Interest is
          per loan (0% = equal instalments).
        </p>
        <div className='mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-3 lg:grid-cols-6'>
          <label className='sm:col-span-2'>
            Employee
            <select
              value={form.employeeId}
              onChange={(e) => set('employeeId', e.target.value)}
              className={inputClass}
            >
              <option value=''>Pick someone on payroll…</option>
              {(people.data ?? []).map((p) => (
                <option key={p.employee.id} value={p.employee.id}>
                  {p.employee.name} ({p.employee.employeeCode})
                </option>
              ))}
            </select>
          </label>
          <label>
            Kind
            <select
              value={form.kind}
              onChange={(e) => set('kind', e.target.value)}
              className={inputClass}
            >
              <option value='loan'>Loan</option>
              <option value='advance'>Salary advance</option>
            </select>
          </label>
          <label>
            Amount (₹)
            <input
              type='number'
              min={0}
              value={form.principal}
              onChange={(e) => set('principal', e.target.value)}
              className={inputClass}
            />
          </label>
          <label>
            Interest % / yr
            <input
              type='number'
              min={0}
              max={50}
              step={0.25}
              value={form.interestRatePct}
              onChange={(e) => set('interestRatePct', e.target.value)}
              className={inputClass}
            />
          </label>
          <label>
            Months
            <input
              type='number'
              min={1}
              max={120}
              disabled={form.kind === 'advance'}
              value={form.kind === 'advance' ? '1' : form.months}
              onChange={(e) => set('months', e.target.value)}
              className={`${inputClass} disabled:bg-slate-50`}
            />
          </label>
          <label>
            First EMI month
            <input
              type='month'
              value={form.startMonth}
              onChange={(e) => set('startMonth', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className='sm:col-span-2 lg:col-span-4'>
            Note (optional)
            <input
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              className={inputClass}
            />
          </label>
          <div className='flex items-end'>
            <button
              type='button'
              disabled={!ready || create.isPending}
              onClick={() => create.mutate()}
              className='w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
            >
              Record
            </button>
          </div>
        </div>
        {create.error && (
          <p className='mt-2 text-xs text-red-600'>{apiErrorMessage(create.error)}</p>
        )}
      </div>

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-slate-700'>Register</h2>
          <label className='flex items-center gap-1 text-xs text-slate-500'>
            <input
              type='checkbox'
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            Show closed
          </label>
        </div>
        {loans.error && <p className='text-sm text-red-600'>{apiErrorMessage(loans.error)}</p>}
        {list.length === 0 && !loans.isLoading && (
          <p className='text-sm text-slate-500'>No {showClosed ? '' : 'active '}loans.</p>
        )}
        <ul className='space-y-2'>
          {list.map((l) => (
            <LoanRow
              key={l.id}
              loan={l}
              open={openId === l.id}
              onToggle={() => setOpenId(openId === l.id ? null : l.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LoansPanel;

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { AnnexureInput, SalaryAnnexure } from '@app-types/api.types';
import { usePtStates } from '@hooks/Common/usePtStates.hook';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

const money = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * The annexure breakup table, shared by the standalone offer calculator and
 * the Compensation panel's live preview. Priced by the payslip engine itself
 * (blended PF, PT, full-year TDS with marginal relief), so an offer or a
 * saved CTC can never disagree with month one's slip.
 */
export const BreakdownTable = ({ data }: { data: SalaryAnnexure }) => {
  const rows: Array<{ label: string; monthly: number; deduction?: boolean; note?: string }> = [
    { label: 'Basic (50%)', monthly: data.basic },
    { label: 'HRA (25%)', monthly: data.hra },
    { label: 'LTA (10%)', monthly: data.lta },
    { label: 'Special allowance', monthly: data.specialAllowance, note: 'balancing figure' },
    { label: 'PF — employer', monthly: data.pfEmployer, note: 'blended 16/14-day rule, same as the payslip' },
    { label: 'Gross salary', monthly: data.grossSalary, note: 'CTC − employer PF' },
    { label: 'PF — employee', monthly: data.pfEmployee, deduction: true },
    { label: 'Professional tax', monthly: data.professionalTax, deduction: true },
    { label: 'Health insurance', monthly: data.healthInsurance, deduction: true },
    { label: 'CNPS (employer)', monthly: data.cnpsEmployer, deduction: true },
    {
      label: 'Estimated TDS',
      monthly: data.tdsPerMonth,
      deduction: true,
      note:
        data.variablePayAnnual > 0
          ? 'full-year projection incl. variable pay, marginal relief applied'
          : 'full-year projection, marginal relief applied',
    },
  ];

  return (
    <div className='max-w-2xl'>
      <div className='flex items-baseline justify-between'>
        <h3 className='text-sm font-semibold text-slate-700'>
          CTC ₹{money(data.ctcAnnual)} / year · ₹{money(data.ctcMonthly)} / month
        </h3>
        <span className='text-xs text-slate-400'>
          {data.variablePayAnnual > 0 && <>variable ₹{money(data.variablePayAnnual)}/yr · </>}
          taxable ₹{money(data.taxableIncome)} → tax ₹{money(data.totalTaxAnnual)}/yr
          {data.surchargeAnnual > 0 && <> (incl. surcharge ₹{money(data.surchargeAnnual)})</>}
        </span>
      </div>
      <table className='mt-2 w-full text-sm'>
        <thead>
          <tr className='border-b border-slate-200 text-xs text-slate-500'>
            <th className='py-2 pr-3 text-left font-medium'>Component</th>
            <th className='py-2 pr-3 text-right font-medium'>Monthly</th>
            <th className='py-2 text-right font-medium'>Annual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className='border-b border-slate-100'>
              <td className='py-1.5 pr-3 text-slate-700'>
                {r.label}
                {r.note && <span className='ml-2 text-xs text-slate-400'>{r.note}</span>}
              </td>
              <td className={`py-1.5 pr-3 text-right tabular-nums ${r.deduction ? 'text-red-600' : 'text-slate-700'}`}>
                {r.deduction && r.monthly > 0 ? '−' : ''}
                {money(r.monthly)}
              </td>
              <td className={`py-1.5 text-right tabular-nums ${r.deduction ? 'text-red-600' : 'text-slate-500'}`}>
                {r.deduction && r.monthly > 0 ? '−' : ''}
                {money(Math.round(r.monthly * 12 * 100) / 100)}
              </td>
            </tr>
          ))}
          <tr>
            <td className='py-2 pr-3 font-semibold text-slate-800'>Net take-home (bank figure)</td>
            <td className='py-2 pr-3 text-right font-semibold tabular-nums text-slate-800'>
              {money(data.netTakeHome)}
            </td>
            <td className='py-2 text-right font-semibold tabular-nums text-slate-800'>
              {money(Math.round(data.netTakeHome * 12 * 100) / 100)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className='mt-2 text-xs text-slate-400'>
        Net take-home is AFTER professional tax and estimated TDS — what actually lands in the
        bank in a full month.
      </p>
    </div>
  );
};

/**
 * Standalone offer calculator — for CANDIDATES who aren't employees yet.
 * Shown in the Compensation tab when no person is selected; picking a person
 * swaps in the same breakup wired to their salary record instead.
 */
const AnnexurePanel = () => {
  const [ctc, setCtc] = useState('');
  const ptStates = usePtStates();
  const [ptState, setPtState] = useState<string | null>(null);
  const [variablePay, setVariablePay] = useState('0');
  const [healthInsurance, setHealthInsurance] = useState('541');
  // Until the person picks, price with the first PT state (the usual office).
  const effectiveState = ptState ?? ptStates[0] ?? '';
  const [cnpsPercent, setCnpsPercent] = useState('0');
  const [basicPercent, setBasicPercent] = useState('50');
  const [hraPercent, setHraPercent] = useState('25');
  const [params, setParams] = useState<AnnexureInput | null>(null);

  const { data, isFetching, error } = useQuery({
    queryKey: ['payroll-annexure', params],
    queryFn: () => payrollApi.annexure(params!),
    enabled: params !== null,
  });

  const compute = () => {
    const annual = Number(ctc);
    if (!annual || annual <= 0) return;
    setParams({
      ctc: annual,
      ...(effectiveState ? { ptState: effectiveState } : {}),
      variablePay: Number(variablePay) || 0,
      healthInsurance: Number(healthInsurance) || 0,
      cnpsPercent: Number(cnpsPercent) || 0,
      basicPercent: Number(basicPercent) || 50,
      hraPercent: Number(hraPercent) || 0,
    });
  };

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <p className='mb-3 text-xs text-slate-400'>
        Price an offer for a CANDIDATE (not on the roster yet): the annexure an offer letter
        promises, computed by the payslip engine. Nothing is stored — once they join, pick them
        on the left and the same breakup drives their compensation record.
      </p>

      <div className='flex flex-wrap items-end gap-3'>
        <label className='text-xs text-slate-500'>
          Annual CTC (₹)
          <input
            type='number'
            min={0}
            step={10000}
            value={ctc}
            onChange={(e) => setCtc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') compute();
            }}
            placeholder='12,00,000'
            className='mt-1 block w-40 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        <label className='text-xs text-slate-500'>
          Health insurance /mo
          <input
            type='number'
            min={0}
            value={healthInsurance}
            onChange={(e) => setHealthInsurance(e.target.value)}
            className='mt-1 block w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        <label className='text-xs text-slate-500'>
          Basic %
          <input
            type='number'
            min={1}
            max={90}
            value={basicPercent}
            onChange={(e) => setBasicPercent(e.target.value)}
            className='mt-1 block w-20 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        <label className='text-xs text-slate-500'>
          HRA %
          <input
            type='number'
            min={0}
            max={89}
            value={hraPercent}
            onChange={(e) => setHraPercent(e.target.value)}
            className='mt-1 block w-20 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        <label className='text-xs text-slate-500'>
          CNPS %
          <input
            type='number'
            min={0}
            max={100}
            step={0.5}
            value={cnpsPercent}
            onChange={(e) => setCnpsPercent(e.target.value)}
            className='mt-1 block w-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        <label className='text-xs text-slate-500'>
          Variable pay (₹/yr)
          <input
            type='number'
            min={0}
            step={10000}
            value={variablePay}
            onChange={(e) => setVariablePay(e.target.value)}
            className='mt-1 block w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </label>
        <label className='text-xs text-slate-500'>
          PT state
          <select
            value={effectiveState}
            onChange={(e) => setPtState(e.target.value)}
            className='mt-1 block w-36 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          >
            {ptStates.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
            <option value=''>None (no PT)</option>
          </select>
        </label>
        <button
          type='button'
          disabled={!Number(ctc) || isFetching}
          onClick={compute}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
        >
          {isFetching ? 'Computing…' : 'Break it up'}
        </button>
      </div>

      {error && <p className='mt-3 text-sm text-red-600'>{apiErrorMessage(error)}</p>}
      {data && (
        <div className='mt-5'>
          <BreakdownTable data={data} />
        </div>
      )}
    </div>
  );
};

export default AnnexurePanel;

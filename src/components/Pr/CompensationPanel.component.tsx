import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AnnexureInput, UpdateEmployeeSalaryInput } from '@app-types/api.types';
import AnnexurePanel, { BreakdownTable } from '@components/Pr/AnnexurePanel.component';
import { employeesApi } from '@services/api/employees.api';
import { usePtStates } from '@hooks/Common/usePtStates.hook';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

interface Draft {
  ctc: string;
  basicPercent: string;
  hraPercent: string;
  tdsAmount: string;
  otherDeductionAmount: string;
  cnpsPercent: string;
  variablePay: string;
  salaryMode: string;
  panNumber: string;
  providentFundAccount: string;
  payrollCostCenter: string;
  bankName: string;
  bankAccountNo: string;
  ifscCode: string;
}

const EMPTY: Draft = {
  ctc: '',
  basicPercent: '',
  hraPercent: '',
  tdsAmount: '',
  otherDeductionAmount: '',
  cnpsPercent: '',
  variablePay: '',
  salaryMode: 'Bank',
  panNumber: '',
  providentFundAccount: '',
  payrollCostCenter: '',
  bankName: '',
  bankAccountNo: '',
  ifscCode: '',
};

/**
 * Where PR puts someone ON payroll: set the CTC (which is what makes payslip
 * generation include them) plus the recurring entries and bank details. PF,
 * PT and the salary structure are computed by the sheet engine — nothing to
 * type here. The people list is the whole org (invited joiners included, so
 * salary is ready before day one); opening a record goes through the
 * pr.payroll.compensation door.
 */
const CompensationPanel = () => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const directory = useQuery({
    queryKey: ['payroll-people'],
    queryFn: payrollApi.people,
  });
  // Who already has a CTC — the TDS list only contains people on payroll.
  const onPayroll = useQuery({ queryKey: ['payroll-tds'], queryFn: payrollApi.tdsEstimates });
  const salary = useQuery({
    queryKey: ['employee-salary', selectedId],
    queryFn: () => employeesApi.getSalary(selectedId!),
    enabled: selectedId !== null,
  });

  const payrollIds = useMemo(
    () => new Set((onPayroll.data ?? []).map((r) => r.employee.id)),
    [onPayroll.data],
  );

  // Hydrate the form whenever a fresh salary record arrives.
  const record = salary.data;
  const hydrated = useMemo<Draft | null>(() => {
    if (!record) return null;
    return {
      ctc: record.ctc ?? '',
      basicPercent: record.basicPercent ?? '',
      hraPercent: record.hraPercent ?? '',
      tdsAmount: record.tdsAmount ?? '',
      otherDeductionAmount: record.otherDeductionAmount ?? '',
      cnpsPercent: record.cnpsPercent ?? '',
      variablePay: record.variablePay ?? '',
      salaryMode: record.salaryMode ?? 'Bank',
      panNumber: record.panNumber ?? '',
      providentFundAccount: record.providentFundAccount ?? '',
      payrollCostCenter: record.payrollCostCenter ?? '',
      bankName: record.bankName ?? '',
      bankAccountNo: record.bankAccountNo ?? '',
      ifscCode: record.ifscCode ?? '',
    };
  }, [record]);
  const form = draft ?? hydrated ?? EMPTY;
  // Without pr.payroll.bank_details the server hides the bank fields; never
  // send them back (it would refuse the whole save).
  const bankHidden = record?.bankDetailsHidden === true;
  const set = <K extends keyof Draft>(key: K, value: string) =>
    setDraft({ ...form, [key]: value });

  const save = useMutation({
    mutationFn: () => {
      const v = (s: string): string | null => (s.trim() === '' ? null : s.trim());
      const input: UpdateEmployeeSalaryInput = {
        ctc: v(form.ctc),
        basicPercent: v(form.basicPercent),
        hraPercent: v(form.hraPercent),
        tdsAmount: v(form.tdsAmount),
        otherDeductionAmount: v(form.otherDeductionAmount),
        cnpsPercent: v(form.cnpsPercent),
        variablePay: v(form.variablePay),
        salaryMode: v(form.salaryMode),
        panNumber: v(form.panNumber),
        providentFundAccount: v(form.providentFundAccount),
        payrollCostCenter: v(form.payrollCostCenter),
        ...(bankHidden
          ? {}
          : {
              bankName: v(form.bankName),
              bankAccountNo: v(form.bankAccountNo),
              ifscCode: v(form.ifscCode),
            }),
      };
      return employeesApi.updateSalary(selectedId!, input);
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ['employee-salary', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['payroll-tds'] });
    },
  });

  const people = (directory.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Live breakup: the annexure for whatever CTC/CNPS is in the form, so PR
  // sees exactly what month one pays BEFORE saving. Debounced while typing;
  // PT eligibility and health insurance are preview-only knobs (the real PT
  // comes from the base zone at run time, health insurance is per payslip).
  const ptStates = usePtStates();
  const [ptState, setPtState] = useState<string | null>(null);
  const effectiveState = ptState ?? ptStates[0] ?? '';
  const [healthIns, setHealthIns] = useState('541');
  const [preview, setPreview] = useState<AnnexureInput | null>(null);
  const ctcNum = Number(form.ctc);
  const cnpsNum = Number(form.cnpsPercent) || 0;
  const variableNum = Number(form.variablePay) || 0;
  const basicNum = Number(form.basicPercent) || 50;
  const hraNum = form.hraPercent.trim() === '' ? 25 : Number(form.hraPercent) || 0;
  useEffect(() => {
    if (!selectedId || !ctcNum || ctcNum <= 0) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(
      () =>
        setPreview({
          ctc: ctcNum,
          ...(effectiveState ? { ptState: effectiveState } : {}),
          variablePay: variableNum,
          healthInsurance: Number(healthIns) || 0,
          cnpsPercent: cnpsNum,
          basicPercent: basicNum,
          hraPercent: hraNum,
        }),
      400,
    );
    return () => clearTimeout(timer);
  }, [selectedId, ctcNum, cnpsNum, variableNum, basicNum, hraNum, effectiveState, healthIns]);
  const breakup = useQuery({
    queryKey: ['payroll-annexure', preview],
    queryFn: () => payrollApi.annexure(preview!),
    enabled: preview !== null,
    placeholderData: (prev) => prev,
  });

  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
      <div className='rounded-xl border border-slate-200 bg-white p-4'>
        <input
          placeholder='Search people…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} mb-3`}
        />
        {directory.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {directory.error && (
          <p className='text-sm text-red-600'>{apiErrorMessage(directory.error)}</p>
        )}
        <div className='max-h-[26rem] space-y-1 overflow-y-auto'>
          {people.map((p) => (
            <button
              key={p.id}
              type='button'
              onClick={() => {
                setSelectedId(p.id);
                setDraft(null);
              }}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                selectedId === p.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'
              }`}
            >
              <span className='truncate'>
                {p.name}
                <span className='ml-1 font-mono text-xs text-slate-400'>{p.employeeCode}</span>
              </span>
              {p.status === 'invited' ? (
                <span className='shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700'>
                  joining
                </span>
              ) : payrollIds.has(p.id) ? (
                <span className='shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] text-green-700'>
                  on payroll
                </span>
              ) : (
                <span className='shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700'>
                  no CTC
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!selectedId ? (
        <div className='space-y-4 lg:col-span-2'>
          <div className='rounded-xl border border-slate-200 bg-white p-5'>
            <p className='text-sm text-slate-500'>
              Pick a person. Setting a CTC is what puts them on payroll — the next run
              generation includes them; clearing it moves them to the run's "skipped" list.
            </p>
          </div>
          <AnnexurePanel />
        </div>
      ) : (
      <div className='rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2'>
        {selectedId && salary.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {selectedId && salary.error && (
          <p className='text-sm text-red-600'>{apiErrorMessage(salary.error)}</p>
        )}
        {selectedId && record && (
          <div className='space-y-4'>
            <p className='text-xs text-slate-400'>
              The payslip engine computes PF (both sides), PT and the Basic 50 / HRA 25 / LTA 10
              structure from the CTC — only the entries below are typed in. Monthly TDS usually
              comes from the TDS calculator's Apply button.
            </p>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
              <div className='space-y-1'>
                <label className={labelClass}>Annual CTC (₹)</label>
                <input value={form.ctc} onChange={(e) => set('ctc', e.target.value)} className={inputClass} placeholder='e.g. 1200000' />
              </div>
              <div className='space-y-1'>
                <label className={labelClass}>TDS / month (₹)</label>
                <input value={form.tdsAmount} onChange={(e) => set('tdsAmount', e.target.value)} className={inputClass} />
              </div>
              <div className='space-y-1'>
                <label className={labelClass}>Other deduction (₹/mo)</label>
                <input value={form.otherDeductionAmount} onChange={(e) => set('otherDeductionAmount', e.target.value)} className={inputClass} />
              </div>
              <div className='space-y-1'>
                <label className={labelClass} title='Blank = 50%. Basic + HRA + LTA (10%) must stay within 100%.'>
                  Basic % of monthly CTC
                </label>
                <input value={form.basicPercent} onChange={(e) => set('basicPercent', e.target.value)} className={inputClass} placeholder='50' />
              </div>
              <div className='space-y-1'>
                <label className={labelClass} title='Blank = 25%.'>HRA % of monthly CTC</label>
                <input value={form.hraPercent} onChange={(e) => set('hraPercent', e.target.value)} className={inputClass} placeholder='25' />
              </div>
              <div className='space-y-1'>
                <label className={labelClass}>CNPS %</label>
                <input value={form.cnpsPercent} onChange={(e) => set('cnpsPercent', e.target.value)} className={inputClass} placeholder='0' />
              </div>
              <div className='space-y-1'>
                <label className={labelClass} title='Annual target; joins taxable income in the TDS projection. Pay it on a payslip as "Other +".'>
                  Variable pay (₹/yr)
                </label>
                <input value={form.variablePay} onChange={(e) => set('variablePay', e.target.value)} className={inputClass} placeholder='0' />
              </div>
              <div className='space-y-1'>
                <label className={labelClass}>Salary mode</label>
                <input value={form.salaryMode} onChange={(e) => set('salaryMode', e.target.value)} className={inputClass} placeholder='Bank / Cash / Cheque' />
              </div>
              <div className='space-y-1'>
                <label className={labelClass}>Cost center</label>
                <input value={form.payrollCostCenter} onChange={(e) => set('payrollCostCenter', e.target.value)} className={inputClass} />
              </div>
              <div className='space-y-1'>
                <label className={labelClass}>PAN</label>
                <input value={form.panNumber} onChange={(e) => set('panNumber', e.target.value)} className={inputClass} />
              </div>
              <div className='space-y-1'>
                <label className={labelClass}>PF account (UAN)</label>
                <input value={form.providentFundAccount} onChange={(e) => set('providentFundAccount', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400'>
                Bank details
              </p>
              {bankHidden ? (
                <p className='rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500'>
                  Hidden — bank details need the separate bank-details access
                  (pr.payroll.bank_details).
                </p>
              ) : (
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                <div className='space-y-1'>
                  <label className={labelClass}>Bank</label>
                  <input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} className={inputClass} />
                </div>
                <div className='space-y-1'>
                  <label className={labelClass}>Account no</label>
                  <input value={form.bankAccountNo} onChange={(e) => set('bankAccountNo', e.target.value)} className={inputClass} />
                </div>
                <div className='space-y-1'>
                  <label className={labelClass}>IFSC</label>
                  <input value={form.ifscCode} onChange={(e) => set('ifscCode', e.target.value)} className={inputClass} />
                </div>
              </div>
              )}
            </div>
            <div className='border-t border-slate-100 pt-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
                  Live breakup — what month one pays
                </p>
                <div className='flex items-center gap-3 text-xs text-slate-500'>
                  <label className='flex items-center gap-1.5'>
                    PT state
                    <select
                      value={effectiveState}
                      onChange={(e) => setPtState(e.target.value)}
                      className='rounded-md border border-slate-300 px-1.5 py-0.5 text-xs'
                    >
                      {ptStates.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                      <option value=''>None</option>
                    </select>
                  </label>
                  <label className='flex items-center gap-1.5'>
                    Health ins./mo
                    <input
                      type='number'
                      min={0}
                      value={healthIns}
                      onChange={(e) => setHealthIns(e.target.value)}
                      className='w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-xs'
                    />
                  </label>
                </div>
              </div>
              {(!ctcNum || ctcNum <= 0) && (
                <p className='mt-2 text-sm text-slate-400'>
                  Type an annual CTC above and the breakup appears here — saving the CTC is what
                  puts them on payroll.
                </p>
              )}
              {breakup.error && (
                <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(breakup.error)}</p>
              )}
              {breakup.data && ctcNum > 0 && (
                <div className='mt-3 space-y-3'>
                  <BreakdownTable data={breakup.data} />
                  {Number(form.tdsAmount || 0) !== breakup.data.tdsPerMonth && (
                    <button
                      type='button'
                      onClick={() =>
                        breakup.data && set('tdsAmount', String(breakup.data.tdsPerMonth))
                      }
                      className='rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100'
                      title='Copies the full-year projection into the TDS/month field above — saved with the record'
                    >
                      Use estimated TDS — ₹
                      {breakup.data.tdsPerMonth.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      /month
                    </button>
                  )}
                </div>
              )}
            </div>
            {save.error && <p className='text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
            <div className='flex justify-end gap-2'>
              {draft && (
                <button
                  type='button'
                  onClick={() => setDraft(null)}
                  className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
                >
                  Discard changes
                </button>
              )}
              <button
                type='button'
                disabled={save.isPending || !draft}
                onClick={() => save.mutate()}
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
              >
                {save.isPending ? 'Saving…' : 'Save compensation'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default CompensationPanel;

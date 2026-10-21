import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  PayrollRun,
  PayrollRunStatus,
  Payslip,
  UpdatePayslipInput,
} from '@app-types/api.types';
import { SettingsList } from '@components/Common/Settings/SettingsList.component';
import CompensationPanel from '@components/Pr/CompensationPanel.component';
import CorrectionModal from '@components/Pr/CorrectionModal.component';
import CorrectionsPanel from '@components/Pr/CorrectionsPanel.component';
import ReimbursementQueue from '@components/Pr/ReimbursementQueue.component';
import TdsCalculator from '@components/Pr/TdsCalculator.component';
import LoansPanel from '@components/Pr/LoansPanel.component';
import JoinerTasks from '@components/Common/Onboarding/JoinerTasks.component';
import { payrollApi } from '@services/api/payroll.api';
import { apiErrorMessage } from '@utils/apiError';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);

const STATUS_STYLES: Record<PayrollRunStatus, string> = {
  draft: 'bg-amber-50 text-amber-700',
  finalized: 'bg-blue-50 text-blue-700',
  paid: 'bg-green-50 text-green-700',
};

const StatusBadge = ({ status }: { status: PayrollRunStatus }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
    {status}
  </span>
);

const money = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * One editable number cell (draft runs only). Commits on blur/Enter AND after
 * a short pause — the pause covers the number input's spinner arrows, which
 * change the value without ever blurring the field.
 */
const EditableCell = ({
  value,
  onCommit,
  onDirtyChange,
  disabled,
}: {
  value: number;
  onCommit: (v: number) => void;
  /** Reports an uncommitted draft so the page can hold Finalize/Re-pull (M12). */
  onDirtyChange?: (dirty: boolean) => void;
  disabled: boolean;
}) => {
  const [draft, setDraft] = useState<string | null>(null);

  const pending = draft !== null && draft !== '' && Number(draft) !== value;

  useEffect(() => {
    onDirtyChange?.(pending);
    // Unmounting (or going clean) must release the hold it took.
    return () => {
      if (pending) onDirtyChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report transitions only
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => onCommit(Number(draft)), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit on settled draft only
  }, [draft, value]);

  // Once the committed value comes back from the server, drop the local draft
  // so the cell tracks the cache again.
  useEffect(() => {
    if (draft !== null && Number(draft) === value) setDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (disabled) return <>{money(value)}</>;
  return (
    <input
      type='number'
      min={0}
      step='0.5'
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (pending) onCommit(Number(draft));
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`w-20 rounded-md border px-1 py-0.5 text-right text-sm ${
        pending ? 'border-amber-400' : 'border-slate-200'
      }`}
    />
  );
};

/**
 * The PR payroll console: generate a draft run for a month, review/edit the
 * payslips (LOP days + deduction amounts), finalize to publish, mark paid.
 * Finalized numbers are immutable snapshots.
 */
const TAB_LABELS = {
  runs: 'Runs',
  compensation: 'Compensation',
  tds: 'TDS calculator',
  reimbursements: 'Reimbursements',
  loans: 'Loans',
  settings: 'Settings',
} as const;

const PayrollPage = () => {
  const queryClient = useQueryClient();
  const [view, setView] = useState<keyof typeof TAB_LABELS>('runs');
  const [month, setMonth] = useState(currentMonth());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Array<{ id: string; name: string }>>([]);
  // Cells with an uncommitted draft — Finalize/Re-pull/Delete wait for zero so
  // a blur-commit PATCH can never race those actions (review finding M12).
  const [dirtyCells, setDirtyCells] = useState(0);
  const cellDirty = (dirty: boolean) => setDirtyCells((c) => Math.max(0, c + (dirty ? 1 : -1)));

  const runs = useQuery({ queryKey: ['payroll-runs'], queryFn: payrollApi.listRuns });
  const runDetail = useQuery({
    queryKey: ['payroll-run', selectedRunId],
    queryFn: () => payrollApi.getRun(selectedRunId!),
    enabled: selectedRunId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-run'] });
  };

  const createRun = useMutation({
    mutationFn: payrollApi.createRun,
    onSuccess: (result) => {
      invalidate();
      setSelectedRunId(result.run.id);
      setSkipped(result.skipped);
    },
  });
  const regenerate = useMutation({
    mutationFn: payrollApi.regenerate,
    onSuccess: (result) => {
      invalidate();
      setSkipped(result.skipped);
    },
  });
  const updatePayslip = useMutation({
    mutationFn: ({
      runId,
      payslipId,
      input,
    }: {
      runId: string;
      payslipId: string;
      input: UpdatePayslipInput;
    }) => payrollApi.updatePayslip(runId, payslipId, input),
    onSuccess: (fresh, variables) => {
      // The PATCH response already carries the recomputed amounts — write it
      // into the cache so LOP amount / net update immediately, instead of
      // waiting for a full run refetch. Keyed by the run the PATCH was sent
      // for, not whatever is selected when the response lands (M12).
      queryClient.setQueryData<{ run: PayrollRun; payslips: Payslip[] }>(
        ['payroll-run', variables.runId],
        (old) =>
          old
            ? { ...old, payslips: old.payslips.map((s) => (s.id === fresh.id ? fresh : s)) }
            : old,
      );
      // The runs list shows the net total — refresh that in the background.
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
  });
  // Deleting a draft is two-step (user decision): first click arms the inline
  // confirmation, only "Yes" fires the mutation.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [correcting, setCorrecting] = useState<Payslip | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const finalize = useMutation({ mutationFn: payrollApi.finalize, onSuccess: invalidate });
  const markPaid = useMutation({ mutationFn: payrollApi.markPaid, onSuccess: invalidate });
  const deleteRun = useMutation({
    mutationFn: payrollApi.deleteRun,
    onSettled: () => setConfirmingDelete(false),
    onSuccess: () => {
      invalidate();
      setSelectedRunId(null);
    },
  });

  const run = runDetail.data?.run;
  const isDraft = run?.status === 'draft';
  const mutationError =
    createRun.error ?? regenerate.error ?? updatePayslip.error ?? finalize.error ??
    markPaid.error ?? deleteRun.error;

  const patch = (slip: Payslip, input: UpdatePayslipInput) => {
    if (!selectedRunId) return;
    updatePayslip.mutate({ runId: selectedRunId, payslipId: slip.id, input });
  };

  // Hold run-level actions while a cell edit is unsaved or its PATCH in flight.
  const editsSettling = dirtyCells > 0 || updatePayslip.isPending;
  const settleTitle = editsSettling ? 'Waiting for cell edits to save…' : undefined;

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold text-slate-800'>Payroll</h1>
        <div className='flex items-center gap-2'>
          {(['runs', 'compensation', 'tds', 'reimbursements', 'loans', 'settings'] as const).map((v) => (
            <button
              key={v}
              type='button'
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {TAB_LABELS[v]}
            </button>
          ))}
          {view === 'runs' && (
            <>
              <input
                type='month'
                value={month}
                onChange={(e) => setMonth(e.target.value || currentMonth())}
                className='rounded-md border border-slate-300 px-3 py-2 text-sm'
              />
              <button
                type='button'
                disabled={createRun.isPending}
                onClick={() => createRun.mutate(month)}
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
              >
                {createRun.isPending ? 'Generating…' : 'Generate run'}
              </button>
            </>
          )}
        </div>
      </div>

      {view === 'tds' && <TdsCalculator />}
      {view === 'compensation' && <CompensationPanel />}
      {view === 'reimbursements' && <ReimbursementQueue />}
      {view === 'loans' && <LoansPanel />}
      {(view === 'runs' || view === 'compensation') && <JoinerTasks owner='payroll' />}
      {view === 'settings' && (
        <div className='max-w-4xl'>
          <SettingsList area='payroll' />
        </div>
      )}

      <div className={view === 'runs' ? 'space-y-4' : 'hidden'}>
      {mutationError && <p className='text-sm text-red-600'>{apiErrorMessage(mutationError)}</p>}
      {skipped.length > 0 && (
        <p className='rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800'>
          Skipped (no CTC set): {skipped.map((s) => s.name).join(', ')} — set their
          compensation via People, then Regenerate.
        </p>
      )}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {runs.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {runs.error && <p className='text-sm text-red-600'>{apiErrorMessage(runs.error)}</p>}
        {runs.data &&
          (runs.data.length === 0 ? (
            <p className='text-sm text-slate-500'>No payroll runs yet — generate one above.</p>
          ) : (
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-xs text-slate-500'>
                  <th className='py-2 pr-3 font-medium'>Month</th>
                  <th className='py-2 pr-3 font-medium'>Status</th>
                  <th className='py-2 pr-3 font-medium'>Payslips</th>
                  <th className='py-2 pr-3 font-medium'>Net total</th>
                  <th className='py-2 font-medium'></th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id} className='border-b border-slate-100'>
                    <td className='py-2 pr-3 font-medium'>{r.month}</td>
                    <td className='py-2 pr-3'>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className='py-2 pr-3'>{r.payslipCount}</td>
                    <td className='py-2 pr-3'>{money(r.netTotal)}</td>
                    <td className='py-2'>
                      <button
                        type='button'
                        onClick={() => {
                          setSelectedRunId(r.id === selectedRunId ? null : r.id);
                          setSkipped([]);
                          setConfirmingDelete(false);
                        }}
                        className='text-xs text-brand-600 hover:underline'
                      >
                        {r.id === selectedRunId ? 'Hide' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>

      <CorrectionsPanel />

      {selectedRunId && runDetail.data && run && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <h2 className='text-lg font-semibold text-slate-800'>{run.month}</h2>
              <StatusBadge status={run.status} />
            </div>
            <div className='flex gap-2'>
              {isDraft && (
                <>
                  <button
                    type='button'
                    disabled={regenerate.isPending || editsSettling}
                    onClick={() => regenerate.mutate(run.id)}
                    title={settleTitle ?? 'Rebuilds every payslip from salary + attendance — manual LOP/deduction edits are discarded'}
                    className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50'
                  >
                    Re-pull from attendance
                  </button>
                  {confirmingDelete ? (
                    <span className='flex items-center gap-2 text-sm whitespace-nowrap'>
                      <span className='text-slate-500'>Delete this draft?</span>
                      <button
                        type='button'
                        disabled={deleteRun.isPending || editsSettling}
                        onClick={() => deleteRun.mutate(run.id)}
                        className='rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50'
                      >
                        Yes
                      </button>
                      <button
                        type='button'
                        onClick={() => setConfirmingDelete(false)}
                        className='text-sm text-slate-400 hover:text-slate-600'
                      >
                        Keep it
                      </button>
                    </span>
                  ) : (
                    <button
                      type='button'
                      disabled={deleteRun.isPending || editsSettling}
                      onClick={() => setConfirmingDelete(true)}
                      title={settleTitle}
                      className='rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50'
                    >
                      Delete draft
                    </button>
                  )}
                  <button
                    type='button'
                    disabled={finalize.isPending || editsSettling}
                    onClick={() => finalize.mutate(run.id)}
                    title={settleTitle}
                    className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
                  >
                    Finalize &amp; publish
                  </button>
                </>
              )}
              {run.status === 'finalized' && (
                <button
                  type='button'
                  disabled={markPaid.isPending}
                  onClick={() => markPaid.mutate(run.id)}
                  className='rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50'
                >
                  Mark paid
                </button>
              )}
            </div>
          </div>

          {isDraft && (
            <p className='mb-3 text-xs text-slate-400'>
              The engine follows the ERP sheet: PF (both sides) and PT compute themselves from
              the prorated salary — the editable columns are what a human types on the sheet
              (LOP, TDS, loan/other, insurance, CNPS and the earnings-side adjustments). Change
              a value and press Enter to recompute. “Re-pull from attendance” rebuilds all
              payslips and <b>discards manual edits</b>. Finalizing locks everything and
              publishes payslips.
            </p>
          )}

          {pdfError && <p className='mb-2 text-sm text-red-600'>{pdfError}</p>}
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-xs text-slate-500'>
                  <th className='py-2 pr-3 font-medium'>Employee</th>
                  <th className='py-2 pr-3 text-right font-medium'>Gross</th>
                  <th className='py-2 pr-3 text-right font-medium'>Work days</th>
                  <th className='py-2 pr-3 text-right font-medium' title='Unmarked absence auto-covered from the EARNED leave balance only'>
                    Auto EL
                  </th>
                  <th className='py-2 pr-3 text-right font-medium'>LOP days</th>
                  <th className='py-2 pr-3 text-right font-medium'>LOP amt</th>
                  <th className='py-2 pr-3 text-right font-medium' title='Computed: 12% of basic at the blended wage caps — employee side'>
                    PF (EE)
                  </th>
                  <th className='py-2 pr-3 text-right font-medium' title='Computed: employer side, also inside CTC'>
                    PF (ER)
                  </th>
                  <th className='py-2 pr-3 text-right font-medium' title='Computed from the state slabs in Settings → Professional tax by state (February can differ)'>
                    PT
                  </th>
                  <th className='py-2 pr-3 text-right font-medium'>TDS</th>
                  <th className='py-2 pr-3 text-right font-medium' title='Loan EMI / recovery / other deductions'>
                    Loan/Other
                  </th>
                  <th className='py-2 pr-3 text-right font-medium'>Health ins</th>
                  <th className='py-2 pr-3 text-right font-medium'>CNPS</th>
                  <th
                    className='py-2 pr-3 text-right font-medium'
                    title='Approved reimbursement claims — read-only; decided in the Reimbursements tab'
                  >
                    Reimb
                  </th>
                  <th className='py-2 pr-3 text-right font-medium'>Perf bonus</th>
                  <th
                    className='py-2 pr-3 text-right font-medium'
                    title='R&R awards approved last month — read-only'
                  >
                    R&amp;R
                  </th>
                  <th className='py-2 pr-3 text-right font-medium' title='Referral / joining / relocation / variable / stipend'>
                    Other +
                  </th>
                  <th className='py-2 pr-3 text-right font-medium'>Encash</th>
                  <th className='py-2 pr-3 text-right font-medium'>Advance</th>
                  <th
                    className='py-2 pr-3 text-right font-medium'
                    title='Corrections to earlier published payslips, carried by this one — read-only'
                  >
                    Correction
                  </th>
                  <th className='py-2 pr-3 text-right font-medium'>Net</th>
                  <th className='py-2 text-right font-medium'>Final pay</th>
                  <th className='py-2 pl-3 font-medium'></th>
                </tr>
              </thead>
              <tbody>
                {runDetail.data.payslips.map((s) => (
                  <tr key={s.id} className='border-b border-slate-100'>
                    <td className='py-2 pr-3'>
                      {s.employee.name}
                      <span className='ml-1 font-mono text-xs text-slate-400'>
                        {s.employee.employeeCode}
                      </span>
                      {s.exitId && (
                        <div className='mt-1 space-y-0.5 text-xs'>
                          <span className='rounded-full bg-violet-50 px-2 py-0.5 text-violet-700'>
                            Full &amp; final
                          </span>
                          <p className='text-slate-500'>
                            {[
                              `EL ${s.encashedElDays}d on Basic`,
                              `gratuity ${money(s.gratuity)} (${s.gratuityYears}y)`,
                              s.noticePay > 0 ? `notice in lieu +${money(s.noticePay)}` : '',
                              s.noticeRecovery > 0 ? `notice short −${money(s.noticeRecovery)}` : '',
                              s.sickLopDeduction > 0
                                ? `${s.sickLopDays} sick days without a certificate −${money(s.sickLopDeduction)}`
                                : '',
                              s.fnfRecovery > 0 ? `recoveries −${money(s.fnfRecovery)}` : '',
                              s.loanEmi > 0 ? `loan balance −${money(s.loanEmi)}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      )}
                      {!s.exitId && s.loanEmi > 0 && (
                        <p className='mt-0.5 text-xs text-slate-500'>
                          Loan / advance EMI −{money(s.loanEmi)}
                        </p>
                      )}
                      {(s.basicPercent !== 50 || s.hraPercent !== 25) && (
                        <p className='mt-0.5 text-xs text-slate-400'>
                          Basic {s.basicPercent}% · HRA {s.hraPercent}%
                        </p>
                      )}
                    </td>
                    <td className='py-2 pr-3 text-right'>{money(s.monthlyGross)}</td>
                    <td className='py-2 pr-3 text-right'>{s.workingDays}</td>
                    <td className='py-2 pr-3 text-right text-xs text-slate-500'>
                      {s.lopOverridden
                        ? 'manual'
                        : s.autoSlDays > 0
                          ? `EL ${s.autoElDays} · SL ${s.autoSlDays}`
                          : s.autoElDays}
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.lopDays}
                        disabled={!isDraft}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { lopDays: v })}
                      />
                    </td>
                    <td className='py-2 pr-3 text-right text-red-600'>{money(s.lopAmount)}</td>
                    <td className='py-2 pr-3 text-right text-slate-500'>{money(s.pf)}</td>
                    <td className='py-2 pr-3 text-right text-slate-500'>{money(s.pfEmployer)}</td>
                    <td className='py-2 pr-3 text-right text-slate-500'>
                      {money(s.professionalTax)}
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell value={s.tds} disabled={!isDraft} onDirtyChange={cellDirty} onCommit={(v) => patch(s, { tds: v })} />
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.otherDeduction}
                        disabled={!isDraft}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { otherDeduction: v })}
                      />
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.healthInsurance}
                        disabled={!isDraft}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { healthInsurance: v })}
                      />
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.cnpsEmployer}
                        disabled={!isDraft}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { cnpsEmployer: v })}
                      />
                    </td>
                    <td
                      className='py-2 pr-3 text-right text-slate-600'
                      title={s.reimbursementClaims
                        .map((c) => `${c.spentOn} · ${c.description}: ${money(c.amount)}`)
                        .join('\n')}
                    >
                      {s.reimbursement > 0 ? money(s.reimbursement) : '—'}
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.performanceBonus}
                        disabled={!isDraft}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { performanceBonus: v })}
                      />
                    </td>
                    <td className='py-2 pr-3 text-right text-slate-600'>
                      {s.recognitionBonus > 0 ? money(s.recognitionBonus) : '—'}
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.otherBonus}
                        disabled={!isDraft}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { otherBonus: v })}
                      />
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.leaveEncashment}
                        // F&F slips work encashment out from the EL balance.
                        disabled={!isDraft || !!s.exitId}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { leaveEncashment: v })}
                      />
                    </td>
                    <td className='py-2 pr-3 text-right'>
                      <EditableCell
                        value={s.advance}
                        disabled={!isDraft}
                        onDirtyChange={cellDirty}
                        onCommit={(v) => patch(s, { advance: v })}
                      />
                    </td>
                    <td
                      className={`py-2 pr-3 text-right ${s.correction < 0 ? 'text-red-600' : 'text-slate-600'}`}
                      title={s.corrections.map((c) => `${c.sourceMonth}: ${c.reason}`).join('\n')}
                    >
                      {s.correction !== 0 ? money(s.correction) : '—'}
                    </td>
                    <td className='py-2 pr-3 text-right'>{money(s.netPay)}</td>
                    <td className='py-2 text-right font-semibold'>{money(s.finalPay)}</td>
                    <td className='py-2 pl-3 text-right'>
                      <span className='inline-flex gap-3 whitespace-nowrap'>
                        <button
                          type='button'
                          onClick={() => {
                            setPdfError(null);
                            payrollApi
                              .downloadRunPayslip(run.id, s.id)
                              .catch((e: unknown) => setPdfError(apiErrorMessage(e)));
                          }}
                          title={isDraft ? 'Draft PDF, watermarked' : 'Download the payslip PDF'}
                          className='text-xs text-slate-500 hover:underline'
                        >
                          PDF
                        </button>
                        {!isDraft && (
                          <button
                            type='button'
                            onClick={() => setCorrecting(s)}
                            className='text-xs text-brand-600 hover:underline'
                          >
                            Correct
                          </button>
                        )}
                      </span>
                      {s.correctedBy.some((c) => c.status !== 'cancelled') && (
                        <span className='block text-[10px] text-slate-400'>corrected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {correcting && run && (
        <CorrectionModal slip={correcting} month={run.month} onClose={() => setCorrecting(null)} />
      )}
      </div>
    </div>
  );
};

export default PayrollPage;

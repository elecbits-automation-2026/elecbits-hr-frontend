import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { ClearanceKind, Exit } from '@app-types/api.types';
import {
  CLEARANCE_LABELS,
  EXIT_STATUS_CLASS,
  EXIT_STATUS_LABELS,
  INTERVIEW_TEXT,
  daysBetween,
  isoToday,
  longDay,
  rupees,
} from '@constants/Common/exits.constants';
import { exitsApi } from '@services/api/exits.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const primary =
  'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40';
const secondary =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40';
const chip = 'rounded-full px-2 py-0.5 text-xs whitespace-nowrap';

const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className='text-sm'>
    <p className='text-xs text-slate-400'>{label}</p>
    <p className='text-slate-700'>{value}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className='space-y-2'>
    <h3 className='text-sm font-semibold text-slate-700'>{title}</h3>
    {children}
  </section>
);

/** A small inline "do it" form: a textarea / extra fields, then confirm. */
const useAction = (onDone: (e: Exit) => void) =>
  useMutation({
    mutationFn: (fn: () => Promise<Exit>) => fn(),
    onSuccess: onDone,
  });

/** One clearance row; the button shows only when the server says you may sign it. */
const ClearanceRow = ({
  exit,
  kind,
  onChanged,
}: {
  exit: Exit;
  kind: ClearanceKind;
  onChanged: (e: Exit) => void;
}) => {
  const c = exit.clearances.find((x) => x.kind === kind)!;
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const act = useAction((e) => {
    setOpen(false);
    onChanged(e);
  });
  const may = exit.can.clear.includes(kind) && kind !== 'payroll';
  return (
    <li className='space-y-1 rounded-lg border border-slate-200 p-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <span
          className={`${chip} ${c.clearedAt ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}
        >
          {c.clearedAt ? '✓ Cleared' : 'Pending'}
        </span>
        <span className='text-sm font-medium text-slate-800'>{CLEARANCE_LABELS[kind].title}</span>
        <span className='text-xs text-slate-400'>{CLEARANCE_LABELS[kind].when}</span>
        {may && !open && (
          <button type='button' onClick={() => setOpen(true)} className={`${primary} ml-auto`}>
            Clear
          </button>
        )}
      </div>
      {c.clearedAt && (
        <p className='text-xs text-slate-500'>
          {c.clearedBy?.name} · {new Date(c.clearedAt).toLocaleString('en-IN')}
          {c.note ? ` — ${c.note}` : ''}
        </p>
      )}
      {!c.clearedAt && c.opensOn && c.opensOn > isoToday() && (
        <p className='text-xs text-slate-400'>Opens {longDay(c.opensOn)}</p>
      )}
      {open && (
        <div className='space-y-2 pt-1'>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Note (optional)'
            className={input}
          />
          {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => setOpen(false)} className={secondary}>
              Back
            </button>
            <button
              type='button'
              disabled={act.isPending}
              onClick={() =>
                act.mutate(() => exitsApi.clear(exit.id, kind as 'hr', note.trim() || undefined))
              }
              className={primary}
            >
              Confirm clearance
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

/** HR: fix the last day and decide a short notice. */
const AcceptForm = ({ exit, onChanged }: { exit: Exit; onChanged: (e: Exit) => void }) => {
  const [lastDay, setLastDay] = useState(exit.proposedLastDay);
  const [action, setAction] = useState<'' | 'waive' | 'recover'>('');
  const [reason, setReason] = useState('');
  const act = useAction(onChanged);
  const shortfall = Math.max(
    0,
    exit.noticeDays - Math.max(0, daysBetween(exit.noticeStartOn, lastDay)),
  );
  return (
    <div className='space-y-2 rounded-lg bg-slate-50 p-3'>
      <p className='text-sm font-medium text-slate-700'>Accept the resignation</p>
      <label className='block space-y-1'>
        <span className='text-xs text-slate-500'>Last working day</span>
        <input
          type='date'
          min={isoToday()}
          value={lastDay}
          onChange={(e) => setLastDay(e.target.value)}
          className={`${input} max-w-xs`}
        />
      </label>
      {shortfall > 0 ? (
        <div className='space-y-2'>
          <p className='text-sm text-amber-800'>
            That's {shortfall} day(s) short of the {exit.noticeDays}-day notice.
          </p>
          <div className='flex gap-4 text-sm text-slate-700'>
            <label className='flex items-center gap-1.5'>
              <input
                type='radio'
                checked={action === 'recover'}
                onChange={() => setAction('recover')}
              />
              Recover on Basic in the F&F
            </label>
            <label className='flex items-center gap-1.5'>
              <input
                type='radio'
                checked={action === 'waive'}
                onChange={() => setAction('waive')}
              />
              Waive
            </label>
          </div>
          {action === 'waive' && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='Why it is waived'
              className={input}
            />
          )}
        </div>
      ) : (
        <p className='text-xs text-slate-500'>The full notice is served.</p>
      )}
      {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}
      <div className='flex justify-end'>
        <button
          type='button'
          disabled={
            act.isPending ||
            !lastDay ||
            (shortfall > 0 && !action) ||
            (action === 'waive' && shortfall > 0 && !reason.trim())
          }
          onClick={() =>
            act.mutate(() =>
              exitsApi.accept(exit.id, {
                lastWorkingDay: lastDay,
                ...(shortfall > 0
                  ? {
                      shortfallAction: action as 'waive',
                      shortfallReason: reason.trim() || undefined,
                    }
                  : {}),
              }),
            )
          }
          className={primary}
        >
          Accept — last day {longDay(lastDay)}
        </button>
      </div>
    </div>
  );
};

/** Payroll: the F&F as it stands, and the recovery lines they type. */
const FnfBlock = ({ exit, onChanged }: { exit: Exit; onChanged: () => void }) => {
  const f = exit.fnf!;
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const add = useMutation({
    mutationFn: () =>
      exitsApi.addRecovery(exit.id, {
        label: label.trim(),
        amount: Number(amount),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setLabel('');
      setAmount('');
      setNote('');
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => exitsApi.removeRecovery(exit.id, id),
    onSuccess: onChanged,
  });
  if (!f.hasSalary) {
    return (
      <p className='text-sm text-amber-700'>No CTC on record — the F&F can't be worked out.</p>
    );
  }
  const rows: Array<[string, number]> = [
    [`Leave encashment — ${f.encashedElDays} EL days on Basic`, f.leaveEncashment],
    [`Gratuity — ${f.gratuityYears} year(s)`, f.gratuity],
    ['Notice pay in lieu', f.noticePay],
    ['Notice shortfall recovered (Basic)', -f.noticeRecovery],
    [`Sick days without a certificate — ${f.sickLopDays}`, -f.sickLopDeduction],
    ['Recoveries', -f.fnfRecovery],
    ['Loan / advance balance', -f.loanBalance],
  ];
  return (
    <div className='space-y-3'>
      <table className='w-full text-sm'>
        <tbody>
          {rows.map(([l, v]) => (
            <tr key={l} className='border-b border-slate-100'>
              <td className='py-1.5 text-slate-600'>{l}</td>
              <td
                className={`py-1.5 text-right tabular-nums ${v < 0 ? 'text-red-700' : 'text-slate-800'}`}
              >
                {v === 0 ? '—' : v < 0 ? `−${rupees(-v)}` : rupees(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className='text-xs text-slate-500'>
        Plus salary up to the last day, reimbursements and awards — all paid in the next monthly
        payroll run once HR, the manager and OPS have cleared.
      </p>
      {f.recoveries.length > 0 && (
        <ul className='space-y-1 text-sm'>
          {f.recoveries.map((r) => (
            <li key={r.id} className='flex items-center gap-2'>
              <span className='text-slate-700'>{r.label}</span>
              {r.note && <span className='text-xs text-slate-400'>{r.note}</span>}
              <span className='ml-auto tabular-nums text-red-700'>{rupees(r.amount)}</span>
              {exit.can.recoveries && (
                <button
                  type='button'
                  onClick={() => remove.mutate(r.id)}
                  className='text-xs text-slate-400 hover:text-red-700'
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {exit.can.recoveries && (
        <div className='grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_8rem]'>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='Recovery (e.g. advance balance, unreturned charger)'
            className={input}
          />
          <input
            type='number'
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder='₹'
            className={input}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Note (optional)'
            className={`${input} sm:col-span-2`}
          />
          {(add.error || remove.error) && (
            <p className='text-sm text-red-600 sm:col-span-2'>
              {apiErrorMessage(add.error ?? remove.error)}
            </p>
          )}
          <div className='flex justify-end sm:col-span-2'>
            <button
              type='button'
              disabled={label.trim().length < 2 || !(Number(amount) > 0) || add.isPending}
              onClick={() => add.mutate()}
              className={primary}
            >
              Add recovery
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * One exit, for whoever is looking: the leaver, their manager, HR, OPS or
 * payroll. What each may do comes from the server (`exit.can`).
 */
const ExitCard = ({
  exit,
  onChanged,
  showPerson = true,
}: {
  exit: Exit;
  onChanged: (e?: Exit) => void;
  showPerson?: boolean;
}) => {
  const [mode, setMode] = useState<null | 'acknowledge' | 'cancel'>(null);
  const [text, setText] = useState('');
  const act = useAction((e) => {
    setMode(null);
    setText('');
    onChanged(e);
  });
  const withdraw = useMutation({
    mutationFn: () => exitsApi.withdraw(exit.id),
    onSuccess: () => onChanged(),
  });
  const docs = useMutation({
    mutationFn: (which: 'relieving' | 'experience' | 'statement') =>
      which === 'statement' ? exitsApi.statement(exit.id) : exitsApi.letter(exit.id, which),
  });
  const closed = exit.status === 'withdrawn' || exit.status === 'cancelled';

  return (
    <div className='space-y-5'>
      <div className='space-y-1'>
        {showPerson && (
          <p className='text-lg font-semibold text-slate-800'>
            {exit.employee.name}{' '}
            <span className='font-mono text-xs font-normal text-slate-400'>
              {exit.employee.employeeCode}
            </span>
          </p>
        )}
        <div className='flex flex-wrap items-center gap-2'>
          <span className={`${chip} ${EXIT_STATUS_CLASS[exit.status]}`}>
            {EXIT_STATUS_LABELS[exit.status]}
          </span>
          <span className='text-sm text-slate-600'>
            {exit.kind === 'resignation' ? 'Resignation' : 'Termination'}
            {exit.employee.designation ? ` · ${exit.employee.designation}` : ''}
            {exit.rm ? ` · reports to ${exit.rm.name}` : ''}
          </span>
        </div>
      </div>

      <div className='grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3'>
        <Fact label='Notice from' value={longDay(exit.noticeStartOn)} />
        <Fact label='Notice period' value={`${exit.noticeDays} days`} />
        <Fact
          label={exit.status === 'submitted' ? 'Proposed last day' : 'Last working day'}
          value={longDay(exit.status === 'submitted' ? exit.proposedLastDay : exit.lastWorkingDay)}
        />
        <Fact label='Notice served' value={`${exit.servedDays} days`} />
        <Fact
          label='Short by'
          value={
            exit.shortfallDays === 0
              ? '—'
              : `${exit.shortfallDays} days${
                  exit.terminationMode === 'pay_in_lieu'
                    ? ' · paid in lieu'
                    : exit.shortfallAction === 'recover'
                      ? ' · recovered on Basic'
                      : exit.shortfallAction === 'waive'
                        ? ` · waived${exit.shortfallReason ? ` (${exit.shortfallReason})` : ''}`
                        : ''
                }`
          }
        />
        <Fact label='Started by' value={exit.initiatedBy.name} />
      </div>

      <Section title={exit.kind === 'resignation' ? 'Reason' : 'Reason for termination'}>
        <p className='whitespace-pre-wrap text-sm text-slate-600'>{exit.reason}</p>
      </Section>

      {exit.handoverPlan && (
        <Section title='Handover plan'>
          <p className='whitespace-pre-wrap text-sm text-slate-600'>{exit.handoverPlan}</p>
          <p className='text-xs text-slate-400'>
            {exit.acknowledgedBy?.name} ·{' '}
            {exit.acknowledgedAt ? new Date(exit.acknowledgedAt).toLocaleString('en-IN') : ''}
          </p>
        </Section>
      )}

      {closed && (
        <p className='rounded-lg bg-slate-50 p-3 text-sm text-slate-600'>
          {exit.status === 'withdrawn' ? 'Withdrawn' : 'Cancelled'} by {exit.closedBy?.name}
          {exit.closeReason ? ` — ${exit.closeReason}` : ''}
        </p>
      )}

      {/* Actions the server allows this viewer */}
      {(exit.can.withdraw || exit.can.acknowledge || exit.can.cancel) && !mode && (
        <div className='flex flex-wrap gap-2'>
          {exit.can.acknowledge && (
            <button type='button' onClick={() => setMode('acknowledge')} className={primary}>
              Acknowledge + handover plan
            </button>
          )}
          {exit.can.withdraw && (
            <button
              type='button'
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate()}
              className={secondary}
            >
              Withdraw my resignation
            </button>
          )}
          {exit.can.cancel && (
            <button type='button' onClick={() => setMode('cancel')} className={secondary}>
              Cancel this exit
            </button>
          )}
        </div>
      )}
      {withdraw.error && <p className='text-sm text-red-600'>{apiErrorMessage(withdraw.error)}</p>}
      {mode && (
        <div className='space-y-2 rounded-lg bg-slate-50 p-3'>
          <textarea
            rows={mode === 'acknowledge' ? 4 : 2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === 'acknowledge'
                ? 'Who takes over what, by when (open work, documents, access, customers)'
                : 'Why the exit is cancelled'
            }
            className={input}
          />
          {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => setMode(null)} className={secondary}>
              Back
            </button>
            <button
              type='button'
              disabled={act.isPending || text.trim().length < (mode === 'acknowledge' ? 10 : 3)}
              onClick={() =>
                act.mutate(() =>
                  mode === 'acknowledge'
                    ? exitsApi.acknowledge(exit.id, text.trim())
                    : exitsApi.cancel(exit.id, text.trim()),
                )
              }
              className={primary}
            >
              {mode === 'acknowledge' ? 'Acknowledge' : 'Cancel exit'}
            </button>
          </div>
        </div>
      )}
      {exit.can.accept && <AcceptForm exit={exit} onChanged={onChanged} />}

      {!closed && (
        <Section title='Clearances'>
          <ul className='space-y-2'>
            {(['hr', 'manager', 'ops', 'payroll'] as const).map((k) => (
              <ClearanceRow key={k} exit={exit} kind={k} onChanged={onChanged} />
            ))}
          </ul>
        </Section>
      )}

      {exit.holdings && (exit.holdings.assets.length > 0 || exit.holdings.passes.length > 0) && (
        <Section title='Still to give back'>
          <ul className='space-y-1 text-sm text-slate-700'>
            {exit.holdings.assets.map((a) => (
              <li key={a.id}>
                <span className='font-mono text-xs text-slate-400'>{a.assetCode}</span> {a.name}
                {a.loanDueOn ? ` · lent until ${longDay(a.loanDueOn)}` : ''}
              </li>
            ))}
            {exit.holdings.passes.map((p) => (
              <li key={p.id}>
                <span className='font-mono text-xs text-slate-400'>{p.assetCode}</span> {p.name} ·
                out on a gate pass until {longDay(p.returnOn)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {exit.interview && (
        <Section title='Exit interview'>
          <dl className='space-y-2 text-sm'>
            {(Object.keys(INTERVIEW_TEXT) as Array<keyof typeof INTERVIEW_TEXT>).map((k) => {
              const v = exit.interview![k];
              if (v === undefined || v === '') return null;
              return (
                <div key={k}>
                  <dt className='text-xs text-slate-400'>{INTERVIEW_TEXT[k]}</dt>
                  <dd className='whitespace-pre-wrap text-slate-700'>
                    {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Section>
      )}

      {exit.fnf && (
        <Section title='Full & final'>
          <FnfBlock exit={exit} onChanged={() => onChanged()} />
        </Section>
      )}

      {exit.can.documents && (
        <Section title='Documents'>
          <div className='flex flex-wrap gap-2'>
            <button type='button' onClick={() => docs.mutate('relieving')} className={secondary}>
              Relieving letter (PDF)
            </button>
            <button type='button' onClick={() => docs.mutate('experience')} className={secondary}>
              Experience letter (PDF)
            </button>
            {exit.fnf && (
              <button type='button' onClick={() => docs.mutate('statement')} className={secondary}>
                F&F statement (PDF)
              </button>
            )}
          </div>
          {docs.error && <p className='text-sm text-red-600'>{apiErrorMessage(docs.error)}</p>}
        </Section>
      )}
    </div>
  );
};

export default ExitCard;

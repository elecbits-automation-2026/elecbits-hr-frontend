import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  HiringPriority,
  InterviewRound,
  Requisition,
  RequisitionInput,
} from '@app-types/api.types';
import RequisitionCard from '@components/Common/Hiring/RequisitionCard.component';
import TaDocumentPanel from '@components/Common/Hiring/TaDocumentPanel.component';
import { TrackerTable } from '@components/Ta/Hiring/Board/HiringReports.component';
import {
  EMPLOYMENT_TYPES,
  PRIORITY_LABEL,
  ROUNDS,
  ROUND_LABEL,
  longDate,
  planViewQuarters,
} from '@constants/Common/hiring.constants';
import { employeesApi } from '@services/api/employees.api';
import { hiringApi } from '@services/api/hiring.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const btn =
  'rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50';

/** Add or edit one line: role, how many, notes, rounds + interviewers. */
const LineForm = ({
  initial,
  title,
  onSave,
  onClose,
  saving,
  error,
}: {
  initial: RequisitionInput;
  title: string;
  onSave: (v: RequisitionInput) => void;
  onClose: () => void;
  saving: boolean;
  error: unknown;
}) => {
  const people = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const [roleTitle, setRoleTitle] = useState(initial.roleTitle);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [reason, setReason] = useState(initial.reason);
  const [targetJoiningOn, setTargetJoiningOn] = useState(initial.targetJoiningOn);
  const [location, setLocation] = useState(initial.location);
  const [reportingManagerId, setReportingManagerId] = useState(initial.reportingManagerId);
  const [priority, setPriority] = useState<HiringPriority>(initial.priority);
  const [employmentType, setEmploymentType] = useState(initial.employmentType);
  const detailsOk =
    reason.trim() && targetJoiningOn && location.trim() && reportingManagerId && employmentType;
  const [rounds, setRounds] = useState<Map<InterviewRound, string | null>>(
    new Map(initial.rounds.map((r) => [r.round, r.interviewerId])),
  );
  const toggle = (round: InterviewRound) =>
    setRounds((prev) => {
      const next = new Map(prev);
      if (next.has(round)) next.delete(round);
      else next.set(round, null);
      return next;
    });
  const pick = (round: InterviewRound, id: string) =>
    setRounds((prev) => new Map(prev).set(round, id || null));
  const valid =
    roleTitle.trim() && quantity >= 1 && quantity <= 50 && rounds.size > 0 && detailsOk;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>{title}</h2>
        <div className='grid grid-cols-[1fr_90px] gap-2'>
          <input
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder='Role, e.g. Hardware Engineer'
            className={input}
          />
          <input
            type='number'
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className={input}
            aria-label='How many'
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder='What you need: skills, experience, why now'
          className={input}
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='Reason for hiring, e.g. backfill for Arjun, new IoT project'
          className={input}
          aria-label='Reason for hiring'
        />
        <div className='grid grid-cols-2 gap-2'>
          <label className='space-y-1'>
            <span className='text-xs text-slate-500'>Target joining date</span>
            <input
              type='date'
              value={targetJoiningOn}
              onChange={(e) => setTargetJoiningOn(e.target.value)}
              className={input}
            />
          </label>
          <label className='space-y-1'>
            <span className='text-xs text-slate-500'>Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder='Bengaluru'
              className={input}
            />
          </label>
          <label className='space-y-1'>
            <span className='text-xs text-slate-500'>Reporting manager</span>
            <select
              value={reportingManagerId}
              onChange={(e) => setReportingManagerId(e.target.value)}
              className={input}
            >
              <option value=''>Pick…</option>
              {people.data
                ?.filter((p) => p.status === 'active')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className='space-y-1'>
            <span className='text-xs text-slate-500'>Employment type</span>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className={input}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className='flex items-center gap-3 text-sm text-slate-700'>
          <span className='text-xs text-slate-500'>Priority</span>
          {(Object.keys(PRIORITY_LABEL) as HiringPriority[]).map((p) => (
            <label key={p} className='flex items-center gap-1'>
              <input type='radio' checked={priority === p} onChange={() => setPriority(p)} />
              {PRIORITY_LABEL[p].label.replace(' priority', '')}
            </label>
          ))}
        </div>
        <div className='space-y-1.5'>
          <p className='text-xs text-slate-500'>
            Interview rounds, in order, and who conducts each — a round opens only after the one
            before it passes
          </p>
          {ROUNDS.map((round) => (
            <div key={round} className='grid grid-cols-[180px_1fr] items-center gap-2'>
              <label className='flex items-center gap-1.5 text-sm text-slate-700'>
                <input
                  type='checkbox'
                  checked={rounds.has(round)}
                  disabled={round === 'hr'}
                  onChange={() => toggle(round)}
                />
                {ROUND_LABEL[round]}
              </label>
              {round === 'hr' ? (
                <span className='text-xs text-slate-500'>
                  Round 1, always — the position&apos;s recruiter (TA SPOC) calls the candidate
                </span>
              ) : rounds.has(round) && (
                <select
                  value={rounds.get(round) ?? ''}
                  onChange={(e) => pick(round, e.target.value)}
                  className={input}
                >
                  <option value=''>
                    {round === 'hr_final' ? 'The recruiter (default)' : 'Name later'}
                  </option>
                  {people.data
                    ?.filter((p) => p.status === 'active')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          ))}
        </div>
        {error ? <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p> : null}
        <div className='flex justify-end gap-2'>
          <button type='button' onClick={onClose} className={btn}>
            Cancel
          </button>
          <button
            type='button'
            disabled={!valid || saving}
            onClick={() =>
              onSave({
                roleTitle: roleTitle.trim(),
                quantity,
                notes: notes.trim() || null,
                reason: reason.trim(),
                targetJoiningOn,
                location: location.trim(),
                reportingManagerId,
                priority,
                employmentType,
                rounds: ROUNDS.filter((r) => rounds.has(r)).map((r) => ({
                  round: r,
                  interviewerId: rounds.get(r) ?? null,
                })),
              })
            }
            className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50'
          >
            {saving ? 'Saving…' : 'Save as draft'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BLANK: RequisitionInput = {
  roleTitle: '',
  quantity: 1,
  notes: null,
  reason: '',
  targetJoiningOn: '',
  location: 'Bengaluru',
  reportingManagerId: '',
  priority: 'normal',
  employmentType: 'Full-time',
  rounds: [
    { round: 'hr', interviewerId: null },
    { round: 'technical', interviewerId: null },
    { round: 'managerial', interviewerId: null },
    { round: 'hr_final', interviewerId: null },
  ],
};

/**
 * The department head's quarterly hiring plan (TA design): add lines for the
 * quarter being planned and submit them; submitted lines wait until the
 * deadline, then all go to HRBP together. A returned line is
 * edited (new version) and goes straight back. Earlier quarters stay visible.
 * Visible only to heads; the backend checks the seat on every call.
 */
const HiringPlanPage = () => {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['hiring-me'], queryFn: hiringApi.me });
  const [deptId, setDeptId] = useState<string>('');
  const [picked, setPicked] = useState<string | null>(null);
  const quarters = me.data ? planViewQuarters(me.data.planQuarter) : [];
  const quarter = picked ?? me.data?.planQuarter ?? '';
  const [form, setForm] = useState<{ edit: Requisition | null } | null>(null);
  // Cancelling is final — the button asks once more.
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const department = deptId || me.data?.headOf[0]?.departmentId || '';

  const plan = useQuery({
    queryKey: ['hiring-plan', department, quarter],
    queryFn: () => hiringApi.plan(department, quarter),
    enabled: !!department && !!quarter,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['hiring-plan'] });

  const save = useMutation({
    mutationFn: (v: RequisitionInput) =>
      form?.edit
        ? hiringApi.update(form.edit.id, v)
        : hiringApi.create({ ...v, departmentId: department, quarter }),
    onSuccess: () => {
      refresh();
      setForm(null);
    },
  });
  const act = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'submit' | 'unqueue' | 'cancel' }) =>
      kind === 'submit'
        ? hiringApi.submit(id)
        : kind === 'unqueue'
          ? hiringApi.unqueue(id)
          : hiringApi.cancel(id),
    onSuccess: refresh,
  });

  if (me.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (me.error) return <p className='text-sm text-red-600'>{apiErrorMessage(me.error)}</p>;
  if (!me.data?.headOf.length)
    return (
      <p className='text-sm text-slate-500'>
        You don&apos;t head a department, so there is no hiring plan to fill. HR assigns heads.
      </p>
    );

  const lines = plan.data?.requisitions ?? [];
  // Drafts never sent; a returned line edited back to draft is resubmitted on its own.
  const drafts = lines.filter((r) => r.status === 'draft' && !r.submittedAt);

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Hiring plan</h1>
          <p className='text-sm text-slate-500'>
            Add the people your department needs next quarter. Submitted lines wait until the
            deadline, then all go to HRBP together; one approval from either
            approves a line, then Admin gives it to a TA RM.
          </p>
        </div>
        <div className='flex gap-2'>
          {me.data.headOf.length > 1 && (
            <select
              value={department}
              onChange={(e) => setDeptId(e.target.value)}
              className='rounded-md border border-slate-300 px-2 py-1.5 text-sm'
            >
              {me.data.headOf.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                  {d.acting ? ' (acting)' : ''}
                </option>
              ))}
            </select>
          )}
          <select
            value={quarter}
            onChange={(e) => setPicked(e.target.value)}
            className='rounded-md border border-slate-300 px-2 py-1.5 text-sm'
          >
            {quarters.map((q, i) => (
              <option key={q} value={q}>
                {q} {i === 0 ? '(planning now)' : '(already sent)'}
              </option>
            ))}
          </select>
          {plan.data?.open && (
            <button
              type='button'
              onClick={() => {
                save.reset();
                setForm({ edit: null });
              }}
              className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700'
            >
              Add a line
            </button>
          )}
        </div>
      </div>

      {plan.data && (
        <p
          className={
            plan.data.open
              ? 'rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-800'
              : 'rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600'
          }
        >
          {plan.data.open
            ? `Plan for ${quarter}: submit lines by ${longDate(plan.data.deadline)}. They wait here until then and go to HRBP the day after. Anything added later goes into the next quarter's plan — for a real emergency, HR hires offline and adds the person directly.`
            : `The ${quarter} plan closed on ${longDate(plan.data.deadline)} and went for approval. Returned lines can still be fixed and resubmitted here.`}
        </p>
      )}
      {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}
      {plan.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {plan.error && <p className='text-sm text-red-600'>{apiErrorMessage(plan.error)}</p>}
      {plan.data && lines.length === 0 && (
        <p className='rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>
          Nothing planned for {quarter} yet.
        </p>
      )}

      {drafts.length > 1 && (
        <div className='flex justify-end'>
          <button
            type='button'
            disabled={act.isPending}
            onClick={async () => {
              for (const r of drafts) await act.mutateAsync({ id: r.id, kind: 'submit' });
            }}
            className={btn}
          >
            Submit all {drafts.length} drafts for {quarter}
          </button>
        </div>
      )}

      <div className='space-y-3'>
        {lines.map((r) => (
          <RequisitionCard
            key={r.id}
            req={r}
            actions={
              <>
                {r.status === 'approved' &&
                  r.positions.map((p) => {
                    // Each position's own JD + scorecard; the recruiter's unsent drafts stay with them.
                    const docs = [p.documents.jd, p.documents.scorecard].filter(
                      (d) => d && d.status !== 'draft',
                    );
                    return (
                      docs.length > 0 && (
                        <div key={p.id} className='w-full space-y-1'>
                          <p className='text-xs font-medium text-slate-500'>
                            Position #{p.number}
                            {p.recruiterName ? ` · ${p.recruiterName}` : ''}
                          </p>
                          <div className='grid gap-3 lg:grid-cols-2'>
                            {docs.map((d) => (
                              <TaDocumentPanel
                                key={d!.id}
                                doc={d!}
                                roleTitle={r.roleTitle}
                                canReview={d!.waitingOn.includes('dept_head')}
                                invalidate={[['hiring-plan']]}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    );
                  })}
                {(r.status === 'draft' || r.status === 'returned') && (
                  <>
                    <button
                      type='button'
                      onClick={() => {
                        save.reset();
                        setForm({ edit: r });
                      }}
                      className={btn}
                    >
                      Edit
                    </button>
                    <button
                      type='button'
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: r.id, kind: 'submit' })}
                      className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50'
                    >
                      {r.status === 'returned' || r.submittedAt ? 'Resubmit' : `Submit for ${quarter}`}
                    </button>
                  </>
                )}
                {r.status === 'queued' && (
                  <button
                    type='button'
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: r.id, kind: 'unqueue' })}
                    className={btn}
                  >
                    Take back to edit
                  </button>
                )}
                {r.status !== 'approved' && r.status !== 'cancelled' && (
                  <button
                    type='button'
                    disabled={act.isPending}
                    onClick={() => {
                      if (confirmCancel !== r.id) return setConfirmCancel(r.id);
                      setConfirmCancel(null);
                      act.mutate({ id: r.id, kind: 'cancel' });
                    }}
                    onBlur={() => setConfirmCancel(null)}
                    className={
                      confirmCancel === r.id
                        ? 'rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700'
                        : btn
                    }
                  >
                    {confirmCancel === r.id ? 'Confirm cancel' : 'Cancel line'}
                  </button>
                )}
              </>
            }
          />
        ))}
      </div>

      <TrackerTable view='external' title='Hiring tracker — your department' />

      {form && (
        <LineForm
          title={form.edit ? `Edit: ${form.edit.roleTitle}` : `New line · ${quarter}`}
          initial={
            form.edit
              ? {
                  roleTitle: form.edit.roleTitle,
                  quantity: form.edit.quantity,
                  notes: form.edit.notes,
                  reason: form.edit.reason ?? '',
                  targetJoiningOn: form.edit.targetJoiningOn ?? '',
                  location: form.edit.location ?? '',
                  reportingManagerId: form.edit.reportingManager?.id ?? '',
                  priority: form.edit.priority,
                  employmentType: form.edit.employmentType ?? 'Full-time',
                  rounds: form.edit.rounds.map((x) => ({
                    round: x.round,
                    interviewerId: x.interviewerId,
                  })),
                }
              : BLANK
          }
          onSave={(v) => save.mutate(v)}
          onClose={() => setForm(null)}
          saving={save.isPending}
          error={save.error}
        />
      )}
    </div>
  );
};

export default HiringPlanPage;

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ActivityKind,
  ActivityOutcome,
  Application,
  Candidate,
} from '@app-types/api.types';
import {
  ACTIVITY_KIND_LABEL,
  ACTIVITY_OUTCOME_LABEL,
  SOURCE_LABEL,
  longDate,
  rupees,
} from '@constants/Common/hiring.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { concernsApi } from '@services/api/concerns.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none';
const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';
const primary =
  'rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const label = 'text-[10px] font-semibold uppercase tracking-wide text-slate-400';

const useRefresh = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['candidate', 'hiring-requisitions', 'pipeline', 'candidates', 'activities']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div>
    <p className={label}>{k}</p>
    <p className='text-sm text-slate-700'>{v || '—'}</p>
  </div>
);

/** The candidate tracker's profile (workflow deck step 7): view, and fill after the call. */
export const Profile = ({ c, canEdit }: { c: Candidate; canEdit: boolean }) => {
  const refresh = useRefresh();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    currentCompany: c.currentCompany ?? '',
    designation: c.designation ?? '',
    location: c.location ?? '',
    noticeDays: c.noticeDays === null ? '' : String(c.noticeDays),
    currentCtc: c.currentCtc === null ? '' : String(c.currentCtc),
    expectedCtc: c.expectedCtc === null ? '' : String(c.expectedCtc),
    availableFrom: c.availableFrom ?? '',
  });
  const save = useMutation({
    mutationFn: () =>
      candidatesApi.update(c.id, {
        currentCompany: f.currentCompany.trim() || null,
        designation: f.designation.trim() || null,
        location: f.location.trim() || undefined,
        noticeDays: f.noticeDays === '' ? undefined : Number(f.noticeDays),
        currentCtc: f.currentCtc === '' ? null : Number(f.currentCtc),
        expectedCtc: f.expectedCtc === '' ? null : Number(f.expectedCtc),
        availableFrom: f.availableFrom || null,
      }),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <section className='space-y-2 rounded-lg border border-slate-200 p-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-semibold text-slate-800'>
          Profile <span className='font-mono text-xs font-normal text-slate-400'>{c.candidateCode}</span>
        </p>
        {canEdit && !editing && (
          <button type='button' onClick={() => setEditing(true)} className={btn}>
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className='grid gap-2 sm:grid-cols-2'>
          <input value={f.currentCompany} onChange={set('currentCompany')} placeholder='Current company' className={input} />
          <input value={f.designation} onChange={set('designation')} placeholder='Designation' className={input} />
          <input value={f.location} onChange={set('location')} placeholder='Location' className={input} />
          <input type='number' min={0} value={f.noticeDays} onChange={set('noticeDays')} placeholder='Notice (days)' className={input} />
          <input type='number' min={0} value={f.currentCtc} onChange={set('currentCtc')} placeholder='Current CTC (₹/yr)' className={input} />
          <input type='number' min={0} value={f.expectedCtc} onChange={set('expectedCtc')} placeholder='Expected CTC (₹/yr)' className={input} />
          <label className='space-y-1 sm:col-span-2'>
            <span className={label}>Available to join from</span>
            <input type='date' value={f.availableFrom} onChange={set('availableFrom')} className={input} />
          </label>
          {save.error && <p className='text-xs text-red-600 sm:col-span-2'>{apiErrorMessage(save.error)}</p>}
          <div className='flex justify-end gap-2 sm:col-span-2'>
            <button type='button' onClick={() => setEditing(false)} className={btn}>
              Cancel
            </button>
            <button type='button' disabled={save.isPending} onClick={() => save.mutate()} className={primary}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3'>
          <Row k='Phone / email' v={[c.phone, c.email].filter(Boolean).join(' · ')} />
          <Row k='Current company' v={c.currentCompany} />
          <Row k='Designation' v={c.designation} />
          <Row k='Experience' v={c.experienceYears === null ? null : `${c.experienceYears} yrs`} />
          <Row k='Education' v={c.education} />
          <Row k='Location' v={c.location} />
          <Row k='Notice period' v={c.noticeDays === null ? null : `${c.noticeDays} days`} />
          <Row k='Current CTC' v={c.currentCtc === null ? null : rupees(c.currentCtc)} />
          <Row k='Expected CTC' v={c.expectedCtc === null ? null : rupees(c.expectedCtc)} />
          <Row k='Available from' v={c.availableFrom ? longDate(c.availableFrom) : null} />
          <Row k='Source' v={SOURCE_LABEL[c.source]} />
          <Row k='Referred by' v={c.referredByName} />
        </div>
      )}
    </section>
  );
};

/** What happens next, who does it and by when (workflow deck: live progress). */
const NextAction = ({ app, canEdit }: { app: Application; canEdit: boolean }) => {
  const refresh = useRefresh();
  const people = useQuery({ queryKey: ['concern-people'], queryFn: concernsApi.people, staleTime: 5 * 60_000 });
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(app.nextAction?.text ?? '');
  const [ownerId, setOwnerId] = useState(app.nextAction?.ownerId ?? '');
  const [due, setDue] = useState(app.nextAction?.due ?? '');
  const save = useMutation({
    mutationFn: (clear: boolean) =>
      candidatesApi.setNextAction(
        app.id,
        clear
          ? { nextAction: null, ownerId: null, due: null }
          : { nextAction: text.trim(), ownerId: ownerId || null, due: due || null },
      ),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });
  const today = new Date().toLocaleDateString('en-CA');
  const overdue = !!app.nextAction?.due && app.nextAction.due < today;

  return (
    <section className='space-y-2 rounded-lg border border-slate-200 p-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-semibold text-slate-800'>Next action</p>
        {canEdit && !editing && (
          <button type='button' onClick={() => setEditing(true)} className={btn}>
            {app.nextAction ? 'Change' : 'Set'}
          </button>
        )}
      </div>
      {editing ? (
        <div className='grid gap-2 sm:grid-cols-[1fr_160px_140px]'>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder='e.g. Share the technical slot' className={input} />
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={input} aria-label='Owner'>
            <option value=''>Owner…</option>
            {people.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type='date' value={due} onChange={(e) => setDue(e.target.value)} className={input} aria-label='Due' />
          {save.error && <p className='text-xs text-red-600 sm:col-span-3'>{apiErrorMessage(save.error)}</p>}
          <div className='flex justify-end gap-2 sm:col-span-3'>
            {app.nextAction && (
              <button type='button' onClick={() => save.mutate(true)} className={btn}>
                Mark done (clear)
              </button>
            )}
            <button type='button' onClick={() => setEditing(false)} className={btn}>
              Cancel
            </button>
            <button type='button' disabled={!text.trim() || save.isPending} onClick={() => save.mutate(false)} className={primary}>
              Save
            </button>
          </div>
        </div>
      ) : app.nextAction ? (
        <p className='text-sm text-slate-700'>
          {app.nextAction.text}
          <span className='text-xs text-slate-500'>
            {app.nextAction.ownerName && <> · {app.nextAction.ownerName}</>}
            {app.nextAction.due && (
              <span className={overdue ? 'font-semibold text-red-600' : ''}>
                {' '}
                · due {longDate(app.nextAction.due)}
                {overdue && ' (overdue)'}
              </span>
            )}
          </span>
        </p>
      ) : (
        <p className='text-sm text-slate-400'>Nothing set.</p>
      )}
    </section>
  );
};

/** Calls, emails, WhatsApp and meetings with the candidate (workflow deck: "calls done"). */
const ActivityLog = ({ app, canEdit }: { app: Application; canEdit: boolean }) => {
  const refresh = useRefresh();
  const log = useQuery({ queryKey: ['activities', app.id], queryFn: () => candidatesApi.activities(app.id) });
  const [kind, setKind] = useState<ActivityKind>('call');
  const [outcome, setOutcome] = useState<ActivityOutcome>('connected');
  const [notes, setNotes] = useState('');
  const add = useMutation({
    mutationFn: () => candidatesApi.logActivity(app.id, { kind, outcome, notes: notes.trim() || undefined }),
    onSuccess: () => {
      setNotes('');
      refresh();
    },
  });

  return (
    <section className='space-y-2 rounded-lg border border-slate-200 p-3'>
      <p className='text-sm font-semibold text-slate-800'>
        Contacts <span className='text-xs font-normal text-slate-400'>{app.contactCount} logged</span>
      </p>
      {canEdit && (
        <div className='grid gap-2 sm:grid-cols-[110px_130px_1fr_auto]'>
          <select value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)} className={input} aria-label='Kind'>
            {(Object.keys(ACTIVITY_KIND_LABEL) as ActivityKind[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as ActivityOutcome)} className={input} aria-label='Outcome'>
            {(Object.keys(ACTIVITY_OUTCOME_LABEL) as ActivityOutcome[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_OUTCOME_LABEL[k]}
              </option>
            ))}
          </select>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='Notes (optional)' className={input} />
          <button type='button' disabled={add.isPending} onClick={() => add.mutate()} className={primary}>
            Log
          </button>
        </div>
      )}
      {add.error && <p className='text-xs text-red-600'>{apiErrorMessage(add.error)}</p>}
      <ul className='max-h-48 space-y-1 overflow-y-auto text-xs'>
        {log.data?.map((x) => (
          <li key={x.id} className='flex flex-wrap gap-x-2 text-slate-600'>
            <span className='font-mono text-slate-400'>
              {new Date(x.happenedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
            <span className='font-medium'>{ACTIVITY_KIND_LABEL[x.kind]}</span>
            <span>· {ACTIVITY_OUTCOME_LABEL[x.outcome]}</span>
            <span className='text-slate-400'>· {x.byName}</span>
            {x.notes && <span className='w-full pl-1 text-slate-500'>{x.notes}</span>}
          </li>
        ))}
        {log.data?.length === 0 && <li className='text-slate-400'>No contacts logged yet.</li>}
      </ul>
    </section>
  );
};

/**
 * The candidate tracker for one application (TA workflow deck step 7): the
 * profile with commercials, the next action and the contact log. Editing is
 * for the position's recruiter or the line's TA RM.
 */
const CandidateTracker = ({ app, canEdit }: { app: Application; canEdit: boolean }) => {
  const c = useQuery({ queryKey: ['candidate', app.candidateId], queryFn: () => candidatesApi.get(app.candidateId) });
  return (
    <div className='space-y-3'>
      {c.data && <Profile key={c.data.id + (c.data.currentCtc ?? '')} c={c.data} canEdit={canEdit} />}
      <NextAction key={app.nextAction?.text ?? 'none'} app={app} canEdit={canEdit} />
      <ActivityLog app={app} canEdit={canEdit} />
    </div>
  );
};

export default CandidateTracker;

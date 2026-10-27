import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Application, BgvStatus, Level, MarkHiredInput } from '@app-types/api.types';
import { BGV_LABEL, HIRE_ROLE_LABEL, budgetText } from '@constants/Common/hiring.constants';
import { concernsApi } from '@services/api/concerns.api';
import { hireApi } from '@services/api/hire.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';
const primary =
  'rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const today = () => new Date().toLocaleDateString('en-CA');

const useRefresh = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['pipeline', 'candidates', 'hiring-requisitions', 'hire-decisions']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
};

/** Where the four stand on the final decision. */
export const DecisionStatus = ({ app }: { app: Application }) => (
  <div className='flex flex-wrap gap-2 text-xs'>
    {app.decision.approvals.map((a) => (
      <span
        key={a.role}
        title={a.reason ?? undefined}
        className={a.decision === 'approve' ? 'text-emerald-700' : 'text-red-600'}
      >
        {a.decision === 'approve' ? '✓' : '✕'} {HIRE_ROLE_LABEL[a.role]} ({a.decidedByName})
      </span>
    ))}
    {app.decision.waitingOn.map((r) => (
      <span key={r} className='text-slate-400'>
        … {HIRE_ROLE_LABEL[r]}
      </span>
    ))}
  </div>
);

/** BGV with the previous employer — alongside the decision and the offer. */
const Bgv = ({ app }: { app: Application }) => {
  const refresh = useRefresh();
  const [status, setStatus] = useState<BgvStatus>(app.bgvStatus);
  const [notes, setNotes] = useState(app.bgvNotes ?? '');
  const save = useMutation({
    mutationFn: () => hireApi.setBgv(app.id, { status, notes: notes.trim() || undefined }),
    onSuccess: refresh,
  });
  return (
    <div className='space-y-1.5'>
      <p className='text-xs font-medium text-slate-500'>
        BGV:{' '}
        <span className={app.bgvStatus === 'failed' ? 'text-red-600' : ''}>
          {BGV_LABEL[app.bgvStatus]}
        </span>
      </p>
      <div className='grid grid-cols-[140px_1fr_auto] gap-2'>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BgvStatus)}
          className={input}
        >
          {(Object.keys(BGV_LABEL) as BgvStatus[]).map((s) => (
            <option key={s} value={s}>
              {BGV_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='Previous employer: role, tenure, conduct, rehire'
          className={input}
        />
        <button
          type='button'
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className={btn}
        >
          Save
        </button>
      </div>
      {save.error && <p className='text-xs text-red-600'>{apiErrorMessage(save.error)}</p>}
    </div>
  );
};

/** Selected → upload the letter (made outside), CTC + joining date → send. */
const Offer = ({ app }: { app: Application }) => {
  const refresh = useRefresh();
  const [ctc, setCtc] = useState('');
  const [joining, setJoining] = useState('');
  const upload = useMutation({
    mutationFn: (file: File) => hireApi.uploadOfferLetter(app.id, file),
    onSuccess: refresh,
  });
  const send = useMutation({
    mutationFn: () => hireApi.makeOffer(app.id, { ctc: Number(ctc), joiningDate: joining }),
    onSuccess: refresh,
  });
  return (
    <div className='space-y-2'>
      <p className='text-xs font-medium text-slate-500'>Offer</p>
      {!app.lineApproved && (
        <p className='rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800'>
          The line is not approved yet — the offer waits for it.
        </p>
      )}
      <div className='flex flex-wrap items-center gap-2'>
        <label className={`${btn} cursor-pointer`}>
          {app.hasOfferLetter ? 'Replace offer letter' : 'Upload offer letter'}
          <input
            type='file'
            accept='.pdf,.doc,.docx'
            className='hidden'
            onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
          />
        </label>
        {app.hasOfferLetter && (
          <button type='button' onClick={() => hireApi.openOfferLetter(app.id)} className={btn}>
            Open letter
          </button>
        )}
      </div>
      <div className='grid grid-cols-[1fr_1fr_auto] gap-2'>
        <input
          type='number'
          min={1}
          value={ctc}
          onChange={(e) => setCtc(e.target.value)}
          placeholder='Annual CTC (₹)'
          className={input}
        />
        <input
          type='date'
          min={today()}
          value={joining}
          onChange={(e) => setJoining(e.target.value)}
          className={input}
          aria-label='Joining date'
        />
        <button
          type='button'
          disabled={
            !app.hasOfferLetter || !Number(ctc) || !joining || !app.lineApproved || send.isPending
          }
          onClick={() => send.mutate()}
          className={primary}
        >
          Send offer
        </button>
      </div>
      {app.budgetMax !== null && Number(ctc) > app.budgetMax && (
        <p className='rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800'>
          Above the line&apos;s budget ({budgetText(app.budgetMin, app.budgetMax)} per hire). You
          can still send it.
        </p>
      )}
      {(upload.error || send.error) && (
        <p className='text-xs text-red-600'>{apiErrorMessage(upload.error ?? send.error)}</p>
      )}
    </div>
  );
};

/** The candidate accepted → the employee record (company email, code, level, RM). */
const MarkHired = ({ app, onClose }: { app: Application; onClose: () => void }) => {
  const refresh = useRefresh();
  const directory = useQuery({
    queryKey: ['concern-people'],
    queryFn: concernsApi.people,
    staleTime: 5 * 60_000,
  });
  const [form, setForm] = useState<MarkHiredInput>({
    email: '',
    employeeCode: '',
    level: 'L2',
    reportsToId: '',
    designation: app.roleTitle,
    employmentType: 'permanent',
  });
  const [link, setLink] = useState<string | null>(null);
  const go = useMutation({
    mutationFn: () => hireApi.markHired(app.id, form),
    onSuccess: (out) => {
      setLink(`${window.location.origin}/auth?claim=${out.claim.token}`);
      refresh();
    },
  });
  const set = (patch: Partial<MarkHiredInput>) => setForm({ ...form, ...patch });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-lg space-y-3 rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>Mark hired: {app.candidateName}</h2>
        {link ? (
          <>
            <p className='text-sm text-slate-600'>
              The employee record is created and onboarding has started. Send the joiner this
              single-use sign-in link (shown once):
            </p>
            <input readOnly value={link} onFocus={(e) => e.target.select()} className={input} />
            <div className='flex justify-end'>
              <button type='button' onClick={onClose} className={primary}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className='text-xs text-slate-500'>
              Joining {app.joiningDate} · {app.departmentName}. The record follows the normal intake
              rules (company email only, the RM must exist).
            </p>
            <div className='grid grid-cols-2 gap-2'>
              <input
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder='Company email'
                className={input}
              />
              <input
                value={form.employeeCode}
                onChange={(e) => set({ employeeCode: e.target.value })}
                placeholder='Employee code'
                className={input}
              />
              <select
                value={form.level}
                onChange={(e) => set({ level: e.target.value as Level })}
                className={input}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={form.employmentType}
                onChange={(e) =>
                  set({ employmentType: e.target.value as MarkHiredInput['employmentType'] })
                }
                className={input}
              >
                <option value='permanent'>Permanent</option>
                <option value='contract'>Contract</option>
                <option value='intern'>Intern</option>
              </select>
            </div>
            <input
              value={form.designation ?? ''}
              onChange={(e) => set({ designation: e.target.value })}
              placeholder='Designation'
              className={input}
            />
            <select
              value={form.reportsToId}
              onChange={(e) => set({ reportsToId: e.target.value })}
              className={input}
            >
              <option value=''>Reporting manager…</option>
              {directory.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {go.error && <p className='text-sm text-red-600'>{apiErrorMessage(go.error)}</p>}
            <div className='flex justify-end gap-2'>
              <button type='button' onClick={onClose} className={btn}>
                Cancel
              </button>
              <button
                type='button'
                disabled={!form.email || !form.employeeCode || !form.reportsToId || go.isPending}
                onClick={() => go.mutate()}
                className={primary}
              >
                Create the employee
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * TA's Step E controls for one application: decision status, BGV, the offer,
 * and once offered — accepted (Mark hired), declined or withdrawn; once hired —
 * did not join. Each ending asks for a reason.
 */
const HirePanel = ({ app }: { app: Application }) => {
  const refresh = useRefresh();
  const [ending, setEnding] = useState<'declined' | 'withdraw' | 'no_show' | null>(null);
  const [reason, setReason] = useState('');
  const [hiring, setHiring] = useState(false);
  const send = useMutation({
    mutationFn: () => hireApi.sendForDecision(app.id),
    onSuccess: refresh,
  });
  const end = useMutation({
    mutationFn: () =>
      ending === 'declined'
        ? hireApi.declined(app.id, reason.trim())
        : ending === 'withdraw'
          ? hireApi.withdrawOffer(app.id, reason.trim())
          : hireApi.noShow(app.id, reason.trim()),
    onSuccess: () => {
      setEnding(null);
      setReason('');
      refresh();
    },
  });
  const LABEL = {
    declined: 'Record decline',
    withdraw: 'Withdraw the offer',
    no_show: 'Did not join',
  };

  return (
    <div className='space-y-3 border-t border-slate-100 pt-2'>
      {app.stage === 'interviewed' && (
        <div className='flex justify-end'>
          <button
            type='button'
            disabled={send.isPending}
            onClick={() => send.mutate()}
            className={primary}
          >
            Send for final decision
          </button>
        </div>
      )}
      {send.error && <p className='text-xs text-red-600'>{apiErrorMessage(send.error)}</p>}
      {(app.stage === 'decision' || app.decision.approvals.length > 0) && (
        <DecisionStatus app={app} />
      )}
      {['interviewed', 'decision', 'selected', 'offered'].includes(app.stage) && <Bgv app={app} />}
      {app.stage === 'selected' && <Offer app={app} />}
      {app.stage === 'offered' && (
        <p className='text-xs text-slate-500'>
          Offer out: ₹{app.offeredCtc?.toLocaleString('en-IN')} · joining {app.joiningDate}
          {app.budgetMax !== null && (app.offeredCtc ?? 0) > app.budgetMax && (
            <span className='ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700'>
              over budget
            </span>
          )}
          {app.hasOfferLetter && (
            <button
              type='button'
              onClick={() => hireApi.openOfferLetter(app.id)}
              className='ml-2 underline'
            >
              letter
            </button>
          )}
        </p>
      )}
      {ending && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder='Reason'
          className={input}
        />
      )}
      {end.error && <p className='text-xs text-red-600'>{apiErrorMessage(end.error)}</p>}
      {(app.stage === 'offered' || app.stage === 'hired') && (
        <div className='flex flex-wrap justify-end gap-2'>
          {ending ? (
            <>
              <button type='button' onClick={() => setEnding(null)} className={btn}>
                Back
              </button>
              <button
                type='button'
                disabled={!reason.trim() || end.isPending}
                onClick={() => end.mutate()}
                className='rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50'
              >
                {LABEL[ending]}
              </button>
            </>
          ) : app.stage === 'offered' ? (
            <>
              <button type='button' onClick={() => setEnding('withdraw')} className={btn}>
                Withdraw offer
              </button>
              <button type='button' onClick={() => setEnding('declined')} className={btn}>
                Declined
              </button>
              <button type='button' onClick={() => setHiring(true)} className={primary}>
                Accepted — mark hired
              </button>
            </>
          ) : (
            <button type='button' onClick={() => setEnding('no_show')} className={btn}>
              Did not join
            </button>
          )}
        </div>
      )}
      {hiring && <MarkHired app={app} onClose={() => setHiring(false)} />}
    </div>
  );
};

export default HirePanel;

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  Application,
  CandidateDocStatus,
  Level,
  MarkHiredInput,
} from '@app-types/api.types';
import { DOC_STATUS_LABEL, rupees } from '@constants/Common/hiring.constants';
import { concernsApi } from '@services/api/concerns.api';
import { hireApi } from '@services/api/hire.api';
import { hiringApi } from '@services/api/hiring.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none';
const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';
const primary =
  'rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const today = () => new Date().toLocaleDateString('en-CA');
const label = 'text-[10px] font-semibold uppercase tracking-wide text-slate-400';

const useRefresh = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['pipeline', 'candidates', 'hiring-requisitions', 'pending-offers', 'candidate-docs']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
};

/** The documents asked once every round passed, and the candidate folder (workflow deck 13–14). */
const Documents = ({ app, canWork }: { app: Application; canWork: boolean }) => {
  const refresh = useRefresh();
  const docs = useQuery({ queryKey: ['candidate-docs', app.id], queryFn: () => hireApi.documents(app.id) });
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(app.folderLink ?? '');
  const set = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CandidateDocStatus }) =>
      hireApi.setDocument(app.id, id, status),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: () => hireApi.addDocument(app.id, name.trim()),
    onSuccess: () => {
      setName('');
      refresh();
    },
  });
  const saveFolder = useMutation({
    mutationFn: () => hireApi.setFolder(app.id, folder.trim() || null),
    onSuccess: refresh,
  });

  return (
    <section className='space-y-2 rounded-lg border border-slate-200 p-3'>
      <p className='text-sm font-semibold text-slate-800'>
        Documents{' '}
        <span className='text-xs font-normal text-slate-400'>
          {app.documents.received} received · {app.documents.pending} pending
        </span>
      </p>
      <ul className='space-y-1'>
        {docs.data?.map((d) => (
          <li key={d.id} className='flex items-center justify-between gap-2 text-sm'>
            <span className={d.status === 'received' ? 'text-slate-700' : 'text-slate-500'}>
              {d.status === 'received' ? '✓ ' : ''}
              {d.name}
            </span>
            {canWork ? (
              <select
                value={d.status}
                onChange={(e) => set.mutate({ id: d.id, status: e.target.value as CandidateDocStatus })}
                className='rounded-md border border-slate-300 px-2 py-0.5 text-xs'
                aria-label={`Status of ${d.name}`}
              >
                {(Object.keys(DOC_STATUS_LABEL) as CandidateDocStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {DOC_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : (
              <span className='text-xs text-slate-500'>{DOC_STATUS_LABEL[d.status]}</span>
            )}
          </li>
        ))}
      </ul>
      {canWork && (
        <div className='flex gap-2'>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ask for another document' className={input} />
          <button type='button' disabled={!name.trim() || add.isPending} onClick={() => add.mutate()} className={btn}>
            Add
          </button>
        </div>
      )}
      <div className='space-y-1'>
        <p className={label}>
          Candidate folder — name it “{app.candidateCode ?? 'C-…'} {app.candidateName}”
        </p>
        {canWork ? (
          <div className='flex gap-2'>
            <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder='https://drive.google.com/…' className={input} />
            <button type='button' disabled={saveFolder.isPending} onClick={() => saveFolder.mutate()} className={btn}>
              Save
            </button>
          </div>
        ) : app.folderLink ? (
          <a href={app.folderLink} target='_blank' rel='noreferrer' className='text-xs text-blue-700 underline'>
            Open the folder
          </a>
        ) : (
          <p className='text-xs text-slate-400'>Not linked yet.</p>
        )}
      </div>
      {(set.error || add.error || saveFolder.error) && (
        <p className='text-xs text-red-600'>{apiErrorMessage(set.error ?? add.error ?? saveFolder.error)}</p>
      )}
    </section>
  );
};

const OFFER_STATUS: Record<NonNullable<Application['offer']>['status'], { text: string; cls: string }> = {
  draft: { text: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  pending: { text: 'With the HR Head', cls: 'bg-blue-50 text-blue-700' },
  returned: { text: 'Returned by the HR Head', cls: 'bg-amber-50 text-amber-800' },
  approved: { text: 'Approved and signed', cls: 'bg-emerald-50 text-emerald-700' },
};

/**
 * The offer (workflow deck step 15): TA drafts the negotiated terms and the
 * letter, sends them to the HR Head, who approves and signs; TA shares the
 * signed offer. Changing approved terms sends them back for approval.
 */
const Offer = ({ app, canWork }: { app: Application; canWork: boolean }) => {
  const refresh = useRefresh();
  const o = app.offer;
  const [ctc, setCtc] = useState(o?.ctc ? String(o.ctc) : '');
  const [joiningDate, setJoiningDate] = useState(o?.joiningDate ?? '');
  const [terms, setTerms] = useState(o?.terms ?? '');
  const [file, setFile] = useState<File | null>(null);
  const editable = canWork && ['interviewed', 'decision', 'selected'].includes(app.stage);
  const dirty =
    !o || Number(ctc) !== o.ctc || joiningDate !== o.joiningDate || terms.trim() !== (o.terms ?? '');
  const save = useMutation({
    mutationFn: async () => {
      if (file) await hireApi.uploadOfferLetter(app.id, file);
      if (dirty) {
        await hireApi.saveOfferDraft(app.id, {
          ctc: Number(ctc),
          joiningDate,
          terms: terms.trim() || undefined,
        });
      }
    },
    onSuccess: () => {
      setFile(null);
      refresh();
    },
  });
  const submit = useMutation({ mutationFn: () => hireApi.submitOffer(app.id), onSuccess: refresh });
  const share = useMutation({ mutationFn: () => hireApi.shareOffer(app.id), onSuccess: refresh });
  const valid = Number(ctc) > 0 && joiningDate >= today();

  return (
    <section className='space-y-2 rounded-lg border border-slate-200 p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-semibold text-slate-800'>Offer</p>
        {o && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OFFER_STATUS[o.status].cls}`}>
            {OFFER_STATUS[o.status].text}
            {o.status === 'approved' && o.approvedByName && <> · {o.approvedByName}</>}
          </span>
        )}
      </div>
      {o?.status === 'returned' && o.returnReason && (
        <p className='rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800'>{o.returnReason}</p>
      )}
      {editable ? (
        <div className='grid gap-2 sm:grid-cols-2'>
          <label className='space-y-1'>
            <span className={label}>Annual CTC (₹)</span>
            <input type='number' min={1} value={ctc} onChange={(e) => setCtc(e.target.value)} className={input} />
          </label>
          <label className='space-y-1'>
            <span className={label}>Joining date</span>
            <input type='date' min={today()} value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className={input} />
          </label>
          <label className='space-y-1 sm:col-span-2'>
            <span className={label}>Other terms (bonus, probation, relocation…)</span>
            <textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} className={input} />
          </label>
          <label className='space-y-1 sm:col-span-2'>
            <span className={label}>
              Draft offer letter (PDF / Word){app.hasOfferLetter && ' — uploaded; choose a file to replace it'}
            </span>
            <input type='file' accept='.pdf,.doc,.docx' onChange={(e) => setFile(e.target.files?.[0] ?? null)} className='text-xs' />
          </label>
          {o?.status === 'approved' && dirty && (
            <p className='rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 sm:col-span-2'>
              Changing approved terms sends the offer back to the HR Head, and the signed letter is
              dropped.
            </p>
          )}
        </div>
      ) : (
        o && (
          <p className='text-sm text-slate-700'>
            {o.ctc !== null && rupees(o.ctc)} per year · joining {o.joiningDate}
            {o.terms && <span className='block text-xs text-slate-500'>{o.terms}</span>}
          </p>
        )
      )}
      <div className='flex flex-wrap items-center justify-end gap-2'>
        {app.hasOfferLetter && (
          <button type='button' onClick={() => hireApi.openOfferLetter(app.id)} className={btn}>
            Draft letter
          </button>
        )}
        {app.hasSignedLetter && (
          <button type='button' onClick={() => hireApi.openSignedLetter(app.id)} className={btn}>
            Signed letter
          </button>
        )}
        {editable && (
          <button type='button' disabled={!valid || (!dirty && !file) || save.isPending} onClick={() => save.mutate()} className={btn}>
            Save
          </button>
        )}
        {canWork && app.stage === 'interviewed' && o && !dirty && (
          <button
            type='button'
            disabled={!app.hasOfferLetter || submit.isPending}
            title={app.hasOfferLetter ? undefined : 'Upload the draft letter first'}
            onClick={() => submit.mutate()}
            className={primary}
          >
            Send to the HR Head
          </button>
        )}
        {canWork && app.stage === 'selected' && !dirty && (
          <button type='button' disabled={share.isPending} onClick={() => share.mutate()} className={primary}>
            Share the signed offer
          </button>
        )}
      </div>
      {(save.error || submit.error || share.error) && (
        <p className='text-xs text-red-600'>{apiErrorMessage(save.error ?? submit.error ?? share.error)}</p>
      )}
    </section>
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
              The employee record is created, onboarding has started and HRBP has the handover.
              Send the joiner this single-use sign-in link (shown once):
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
              <input value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder='Company email' className={input} />
              <input value={form.employeeCode} onChange={(e) => set({ employeeCode: e.target.value })} placeholder='Employee code' className={input} />
              <select value={form.level} onChange={(e) => set({ level: e.target.value as Level })} className={input}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={form.employmentType}
                onChange={(e) => set({ employmentType: e.target.value as MarkHiredInput['employmentType'] })}
                className={input}
              >
                <option value='permanent'>Permanent</option>
                <option value='contract'>Contract</option>
                <option value='intern'>Intern</option>
              </select>
            </div>
            <input value={form.designation ?? ''} onChange={(e) => set({ designation: e.target.value })} placeholder='Designation' className={input} />
            <select value={form.reportsToId} onChange={(e) => set({ reportsToId: e.target.value })} className={input}>
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
 * From "all rounds passed" to joining, for one application: documents, the
 * offer (TA drafts → HR Head approves + signs → TA shares), then accepted
 * (Mark hired), declined or withdrawn; once hired — did not join, or HRBP
 * confirms the joining. Each ending asks for a reason.
 */
const HirePanel = ({ app, canWork }: { app: Application; canWork: boolean }) => {
  const refresh = useRefresh();
  const hiringMe = useQuery({ queryKey: ['hiring-me'], queryFn: hiringApi.me, staleTime: 60_000 });
  const isHrbp = !!hiringMe.data?.approverRoles.includes('hrbp');
  const [ending, setEnding] = useState<'declined' | 'withdraw' | 'no_show' | null>(null);
  const [reason, setReason] = useState('');
  const [hiring, setHiring] = useState(false);
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
  const joined = useMutation({ mutationFn: () => hireApi.confirmJoined(app.id), onSuccess: refresh });
  const LABEL = {
    declined: 'Record decline',
    withdraw: 'Withdraw the offer',
    no_show: 'Did not join',
  };
  const beforeOffer = ['interviewed', 'decision', 'selected'].includes(app.stage);

  return (
    <div className='space-y-3 border-t border-slate-100 pt-2'>
      {(beforeOffer || app.stage === 'offered' || app.stage === 'hired') && (
        <Documents app={app} canWork={canWork} />
      )}
      {beforeOffer && <Offer key={`${app.offer?.status}-${app.offer?.ctc}`} app={app} canWork={canWork} />}
      {app.stage === 'offered' && (
        <p className='text-xs text-slate-500'>
          Offer out: {app.offeredCtc !== null && rupees(app.offeredCtc)} · joining {app.joiningDate}
          {app.hasSignedLetter && (
            <button type='button' onClick={() => hireApi.openSignedLetter(app.id)} className='ml-2 underline'>
              signed letter
            </button>
          )}
        </p>
      )}
      {app.stage === 'joined' && app.joinedAt && (
        <p className='text-xs text-emerald-700'>
          ✓ Joined — confirmed by HRBP on {new Date(app.joinedAt).toLocaleDateString('en-IN')}
        </p>
      )}
      {ending && (
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder='Reason' className={input} />
      )}
      {(end.error || joined.error) && (
        <p className='text-xs text-red-600'>{apiErrorMessage(end.error ?? joined.error)}</p>
      )}
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
            canWork && (
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
            )
          ) : (
            <>
              {canWork && (
                <button type='button' onClick={() => setEnding('no_show')} className={btn}>
                  Did not join
                </button>
              )}
              {isHrbp && (
                <button
                  type='button'
                  disabled={joined.isPending || (!!app.joiningDate && app.joiningDate > today())}
                  title={app.joiningDate && app.joiningDate > today() ? `Joins on ${app.joiningDate}` : undefined}
                  onClick={() => joined.mutate()}
                  className={primary}
                >
                  Confirm joined (HRBP)
                </button>
              )}
            </>
          )}
        </div>
      )}
      {hiring && <MarkHired app={app} onClose={() => setHiring(false)} />}
    </div>
  );
};

export default HirePanel;

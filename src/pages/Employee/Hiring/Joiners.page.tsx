import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Joiner } from '@app-types/api.types';
import { longDate } from '@constants/Common/hiring.constants';
import { hireApi } from '@services/api/hire.api';
import { apiErrorMessage } from '@utils/apiError';

const today = () => new Date().toLocaleDateString('en-CA');

/** Whole days from today to `iso` (negative once it has passed). */
const daysTo = (iso: string) =>
  Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${today()}T00:00:00`)) / 86_400_000);

const whenText = (iso: string | null) => {
  if (!iso) return 'Joining date not set';
  const d = daysTo(iso);
  if (d === 0) return `Joins today · ${longDate(iso)}`;
  if (d > 0) return `Joins in ${d} day${d === 1 ? '' : 's'} · ${longDate(iso)}`;
  return `Was due ${longDate(iso)} · confirm or mark did not join`;
};

/** One hired person: the handover facts, and HRBP's two actions. */
const JoinerCard = ({ j }: { j: Joiner }) => {
  const queryClient = useQueryClient();
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState('');
  const done = () => queryClient.invalidateQueries({ queryKey: ['hiring-joiners'] });
  const joined = useMutation({ mutationFn: () => hireApi.confirmJoined(j.id), onSuccess: done });
  const noShow = useMutation({
    mutationFn: () => hireApi.noShow(j.id, reason.trim()),
    onSuccess: done,
  });
  const error = joined.error ?? noShow.error;
  const early = !!j.joiningDate && j.joiningDate > today();
  const overdue = j.stage === 'hired' && !!j.joiningDate && daysTo(j.joiningDate) < 0;

  return (
    <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div>
          <p className='font-medium text-slate-800'>
            {j.candidateName}{' '}
            {j.candidateCode && (
              <span className='font-mono text-xs text-slate-500'>{j.candidateCode}</span>
            )}
          </p>
          <p className='text-sm text-slate-600'>
            {j.roleTitle} · {j.departmentName}
          </p>
        </div>
        {j.stage === 'joined' ? (
          <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'>
            Joined {j.joinedAt ? longDate(j.joinedAt.slice(0, 10)) : ''}
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              overdue ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {whenText(j.joiningDate)}
          </span>
        )}
      </div>

      <dl className='grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2'>
        <div className='flex gap-2'>
          <dt className='text-slate-500'>Recruiter</dt>
          <dd className='text-slate-800'>{j.recruiterName ?? '—'}</dd>
        </div>
        <div className='flex gap-2'>
          <dt className='text-slate-500'>Documents</dt>
          <dd className={j.documents.pending ? 'text-amber-800' : 'text-slate-800'}>
            {j.documents.received} received, {j.documents.pending} pending
          </dd>
        </div>
        <div className='flex gap-2'>
          <dt className='text-slate-500'>Folder</dt>
          <dd>
            {j.folderLink ? (
              <a
                href={j.folderLink}
                target='_blank'
                rel='noreferrer'
                className='font-medium text-blue-700 underline'
              >
                Open the candidate folder
              </a>
            ) : (
              <span className='text-slate-500'>No link yet</span>
            )}
          </dd>
        </div>
        {j.nextAction && (
          <div className='flex gap-2'>
            <dt className='text-slate-500'>Open action</dt>
            <dd className='text-slate-800'>
              {j.nextAction.text}
              {j.nextAction.ownerName && ` · ${j.nextAction.ownerName}`}
              {j.nextAction.due && ` · due ${longDate(j.nextAction.due)}`}
            </dd>
          </div>
        )}
      </dl>
      {j.pendingDocuments.length > 0 && (
        <p className='text-xs text-amber-800'>Still to collect: {j.pendingDocuments.join(', ')}</p>
      )}

      {j.stage === 'hired' && (
        <div className='space-y-2'>
          {ending && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder='Why did they not join? Their record is deactivated and the position reopens.'
              className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
            />
          )}
          {error && <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>}
          <div className='flex justify-end gap-2'>
            {ending ? (
              <>
                <button
                  type='button'
                  onClick={() => setEnding(false)}
                  className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
                >
                  Back
                </button>
                <button
                  type='button'
                  disabled={!reason.trim() || noShow.isPending}
                  onClick={() => noShow.mutate()}
                  className='rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50'
                >
                  Did not join
                </button>
              </>
            ) : (
              <>
                <button
                  type='button'
                  onClick={() => setEnding(true)}
                  className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
                >
                  Did not join…
                </button>
                <button
                  type='button'
                  disabled={early || joined.isPending}
                  title={early ? `They join on ${j.joiningDate}` : undefined}
                  onClick={() => joined.mutate()}
                  className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50'
                >
                  Confirm joined
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The TA → HRBP handover (workflow deck step 16): everyone TA hired who
 * hasn't joined yet, soonest first, with documents and open actions; HRBP
 * confirms the joining (or records that they did not join). Joiners of the
 * last 30 days stay below for reference.
 */
const JoinersPage = () => {
  const list = useQuery({ queryKey: ['hiring-joiners'], queryFn: hireApi.joiners });

  if (list.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (list.error) return <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>;
  const all = list.data ?? [];
  const coming = all.filter((j) => j.stage === 'hired');
  const joined = all.filter((j) => j.stage === 'joined');

  return (
    <div className='w-full space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Joiners</h1>
        <p className='text-sm text-slate-500'>
          People TA has hired, handed over to HRBP. Confirm each joining on or after the joining
          date; onboarding runs in HR → Onboarding.
        </p>
      </div>
      <section className='space-y-3'>
        <h2 className='text-sm font-semibold uppercase tracking-wide text-slate-500'>
          To join ({coming.length})
        </h2>
        {coming.length === 0 ? (
          <p className='text-sm text-slate-500'>Nobody is waiting to join.</p>
        ) : (
          coming.map((j) => <JoinerCard key={j.id} j={j} />)
        )}
      </section>
      {joined.length > 0 && (
        <section className='space-y-3'>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-slate-500'>
            Joined in the last 30 days ({joined.length})
          </h2>
          {joined.map((j) => (
            <JoinerCard key={j.id} j={j} />
          ))}
        </section>
      )}
    </div>
  );
};

export default JoinersPage;

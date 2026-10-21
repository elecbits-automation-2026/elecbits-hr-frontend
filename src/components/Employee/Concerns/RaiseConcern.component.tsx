import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ConcernTrack, CreatedConcern } from '@app-types/api.types';
import { CATEGORIES, TRACK_CHOICES } from '@constants/Common/concerns.constants';
import { CONCERNS_FOLLOW_UP_ROUTE } from '@constants/Common/navigation/routes.constants';
import { usePublicSettings } from '@hooks/Common/usePublicSettings.hook';
import { concernsApi } from '@services/api/concerns.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

/** The code + key of an anonymous report — shown once, never again. */
const FollowUpKeyCard = ({ created, onDone }: { created: CreatedConcern; onDone: () => void }) => {
  const [copied, setCopied] = useState(false);
  const text = `Case: ${created.concern.code}\nKey: ${created.followUpKey}`;
  return (
    <div className='space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5'>
      <h2 className='text-sm font-semibold text-slate-800'>Save these now — they are shown once</h2>
      <p className='text-sm text-slate-600'>
        Your report was filed anonymously, so it is not linked to you and won&rsquo;t appear under
        My concerns. To read replies or add information, open{' '}
        <Link to={CONCERNS_FOLLOW_UP_ROUTE} className='text-brand-700 underline'>
          Follow up an anonymous report
        </Link>{' '}
        and enter the case code and this key. Nobody — not even HR — can show you the key again.
      </p>
      <pre className='overflow-x-auto rounded-md bg-white p-3 font-mono text-sm text-slate-800'>
        {text}
      </pre>
      <div className='flex gap-2'>
        <button
          type='button'
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => setCopied(true));
          }}
          className='rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type='button'
          onClick={onDone}
          className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500'
        >
          I&rsquo;ve saved them
        </button>
      </div>
    </div>
  );
};

/**
 * Raise a concern. Pick the track by what happened; sexual harassment shows
 * the Internal Committee contact and sends nothing. Disputes are always
 * named; complaints and whistleblower reports may be anonymous.
 */
const RaiseConcern = ({ onFiled }: { onFiled: (id: string | null) => void }) => {
  const queryClient = useQueryClient();
  const { icContact } = usePublicSettings();
  const [track, setTrack] = useState<ConcernTrack | 'posh' | null>(null);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [subject, setSubject] = useState('');
  const [relatedCode, setRelatedCode] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [aboutMyManager, setAboutMyManager] = useState(false);
  const [created, setCreated] = useState<CreatedConcern | null>(null);

  const people = useQuery({
    queryKey: ['concern-people'],
    queryFn: concernsApi.people,
    enabled: track !== null && track !== 'posh',
    staleTime: 5 * 60_000,
  });

  const reset = () => {
    setTrack(null);
    setCategory('');
    setTitle('');
    setDetail('');
    setSubject('');
    setRelatedCode('');
    setAnonymous(false);
    setAboutMyManager(false);
  };

  const create = useMutation({
    mutationFn: () =>
      concernsApi.create({
        track: track as ConcernTrack,
        category,
        title: title.trim(),
        detail: detail.trim(),
        ...(subject ? { subjectEmployeeId: subject } : {}),
        ...(relatedCode.trim() ? { relatedCode: relatedCode.trim() } : {}),
        ...(track !== 'dispute' ? { anonymous } : {}),
        ...(track === 'dispute' ? { aboutMyManager } : {}),
      }),
    onSuccess: (out) => {
      queryClient.invalidateQueries({ queryKey: ['concerns-mine'] });
      reset();
      if (out.followUpKey) setCreated(out);
      else onFiled(out.concern.id);
    },
  });

  if (created) {
    return (
      <FollowUpKeyCard
        created={created}
        onDone={() => {
          setCreated(null);
          onFiled(null);
        }}
      />
    );
  }

  const valid =
    track !== null &&
    track !== 'posh' &&
    category !== '' &&
    title.trim().length >= 5 &&
    detail.trim().length >= 20;

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2'>
        {TRACK_CHOICES.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => {
              setTrack(t.key);
              setCategory('');
              setAnonymous(false);
            }}
            className={`rounded-xl border p-4 text-left transition ${
              track === t.key
                ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className='text-sm font-semibold text-slate-800'>{t.title}</p>
            <p className='mt-1 text-xs text-slate-500'>{t.blurb}</p>
          </button>
        ))}
      </div>

      {track === 'posh' && (
        <div className='rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-slate-700'>
          <h2 className='font-semibold text-rose-800'>Contact the Internal Committee</h2>
          <p className='mt-2'>
            Sexual harassment complaints go to the Internal Committee under the POSH policy. Nothing
            you write here is stored or sent — please reach the committee directly.
          </p>
          <p className='mt-2 font-medium'>
            {icContact ? icContact : 'Ask HR for the Internal Committee contact details.'}
          </p>
        </div>
      )}

      {track !== null && track !== 'posh' && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (valid) create.mutate();
          }}
          className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'
        >
          {track === 'dispute' && (
            <p className='rounded-md bg-amber-50 p-3 text-xs text-amber-800'>
              <strong>No automatic stay.</strong> Raising a dispute does not pause the decision —
              payroll, PIP or other actions go ahead while it is reviewed. Repeating a matter that
              was already decided may be declined.
            </p>
          )}
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='text-xs text-slate-500'>
              {track === 'dispute' ? 'What decision?' : 'What kind?'}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value=''>Choose…</option>
                {Object.entries(CATEGORIES[track]).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className='text-xs text-slate-500'>
              Who is it about? (optional)
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value=''>Nobody in particular</option>
                {(people.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.employeeCode}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className='block text-xs text-slate-500'>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder='One line on what happened'
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className='block text-xs text-slate-500'>
            Details
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder='What happened, when, who was involved or saw it, and what you would like to happen.'
              className={`${inputClass} mt-1`}
            />
            <span className='block text-slate-400'>
              {detail.trim().length} characters (at least 20)
            </span>
          </label>
          <label className='block text-xs text-slate-500'>
            Related earlier case code (optional — e.g. for retaliation)
            <input
              value={relatedCode}
              onChange={(e) => setRelatedCode(e.target.value)}
              maxLength={30}
              placeholder='CMP-2026-001'
              className={`${inputClass} mt-1`}
            />
          </label>

          {track === 'dispute' ? (
            <label className='flex items-start gap-2 text-sm text-slate-600'>
              <input
                type='checkbox'
                checked={aboutMyManager}
                onChange={(e) => setAboutMyManager(e.target.checked)}
                className='mt-1'
              />
              <span>
                The decision was my manager&rsquo;s own — start with HR (level 2) instead of my
                manager.
              </span>
            </label>
          ) : (
            <label className='flex items-start gap-2 text-sm text-slate-600'>
              <input
                type='checkbox'
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className='mt-1'
              />
              <span>
                File anonymously. Your name is not stored; you&rsquo;ll get a case code and a key to
                follow up. Anonymous reports can be harder to investigate.
              </span>
            </label>
          )}

          {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}
          <div className='flex items-center justify-between gap-3'>
            <p className='text-xs text-slate-400'>
              {track === 'dispute'
                ? aboutMyManager
                  ? 'HR acknowledges and decides first.'
                  : 'Your manager decides first; you can escalate to HR, then the committee.'
                : track === 'complaint'
                  ? 'HR acknowledges, investigates and tells you the outcome.'
                  : 'Only the whistleblower (vigil) team can see this.'}{' '}
              The person it&rsquo;s about never sees it.
            </p>
            <button
              type='submit'
              disabled={!valid || create.isPending}
              className='shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
            >
              {create.isPending ? 'Sending…' : 'Raise'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default RaiseConcern;

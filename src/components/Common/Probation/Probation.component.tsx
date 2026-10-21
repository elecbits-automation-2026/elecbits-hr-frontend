import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProbationReview } from '@app-types/api.types';
import { probationApi } from '@services/api/probation.api';
import { apiErrorMessage } from '@utils/apiError';

const day = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const STATUS: Record<ProbationReview['status'], { label: string; cls: string }> = {
  pending: { label: 'waiting on the RM', cls: 'bg-amber-50 text-amber-800' },
  recommended: { label: 'waiting on HR', cls: 'bg-blue-50 text-blue-700' },
  confirmed: { label: 'confirmed', cls: 'bg-green-50 text-green-700' },
  ended: { label: 'ended', cls: 'bg-red-50 text-red-700' },
};

const inputClass =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none';
const btn = 'rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40';

/** One review: dates, the RM's recommendation, HR's decision, and the next step. */
const ReviewRow = ({ r }: { r: ProbationReview }) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [ending, setEnding] = useState(false);
  const [mode, setMode] = useState<'serve' | 'pay_in_lieu'>('serve');
  const [lastDay, setLastDay] = useState('');
  const refresh = () => {
    setNote('');
    setEnding(false);
    void queryClient.invalidateQueries({ queryKey: ['probation'] });
  };
  const recommend = useMutation({
    mutationFn: (recommendation: 'confirm' | 'end') =>
      probationApi.recommend(r.id, { recommendation, note: note.trim() }),
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: (decision: 'confirm' | 'end') =>
      probationApi.decide(r.id, {
        decision,
        note: note.trim(),
        ...(decision === 'end' ? { mode, lastWorkingDay: lastDay } : {}),
      }),
    onSuccess: refresh,
  });
  const letter = useMutation({ mutationFn: () => probationApi.letter(r.id) });
  const look = STATUS[r.status];
  const noteOk = note.trim().length >= 5;
  const err = recommend.error ?? decide.error ?? letter.error;

  return (
    <li className='space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='font-medium text-slate-800'>{r.employee.name}</span>
        <span className='text-xs text-slate-400'>
          {r.employee.designation ?? r.employee.employeeCode}
          {r.employee.department ? ` · ${r.employee.department}` : ''}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${look.cls}`}>{look.label}</span>
        <span className='ml-auto text-xs text-slate-500'>
          Due {day(r.dueOn)}
          {r.status === 'pending' || r.status === 'recommended'
            ? ` · confirms by itself ${day(r.autoConfirmOn)}`
            : ''}
        </span>
      </div>
      {r.recommendation && (
        <p className='text-xs text-slate-600'>
          RM{r.recommendedBy ? ` (${r.recommendedBy.name})` : ''} recommends{' '}
          <b>{r.recommendation === 'confirm' ? 'confirming' : 'ending'}</b>: {r.recommendationNote}
        </p>
      )}
      {r.decidedAt && (
        <p className='text-xs text-slate-600'>
          {r.autoConfirmed
            ? 'Confirmed automatically — nobody decided within 7 days of the date.'
            : `HR${r.decidedBy ? ` (${r.decidedBy.name})` : ''}: ${r.decisionNote ?? ''}`}
          {r.exitId ? ' · a termination exit was started' : ''}
        </p>
      )}
      {err && <p className='text-xs text-red-600'>{apiErrorMessage(err)}</p>}

      {(r.can.recommend || r.can.decide) && (
        <div className='space-y-2'>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={r.can.decide ? 'Your decision note' : 'Why (HR reads this)'}
            className={inputClass}
          />
          {ending && (
            <div className='flex flex-wrap items-end gap-3 text-xs text-slate-600'>
              <label>
                Notice
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'serve' | 'pay_in_lieu')}
                  className={`mt-1 block ${inputClass}`}
                >
                  <option value='serve'>Serve notice</option>
                  <option value='pay_in_lieu'>Pay in lieu</option>
                </select>
              </label>
              <label>
                Last working day
                <input
                  type='date'
                  value={lastDay}
                  onChange={(e) => setLastDay(e.target.value)}
                  className={`mt-1 block ${inputClass}`}
                />
              </label>
            </div>
          )}
          <div className='flex flex-wrap gap-2'>
            {r.can.recommend && (
              <>
                <button
                  type='button'
                  disabled={!noteOk || recommend.isPending}
                  onClick={() => recommend.mutate('confirm')}
                  className={`${btn} bg-green-600 hover:bg-green-500`}
                >
                  Recommend confirming
                </button>
                <button
                  type='button'
                  disabled={!noteOk || recommend.isPending}
                  onClick={() => recommend.mutate('end')}
                  className={`${btn} bg-red-600 hover:bg-red-500`}
                >
                  Recommend ending
                </button>
              </>
            )}
            {r.can.decide && !ending && (
              <>
                <button
                  type='button'
                  disabled={!noteOk || decide.isPending}
                  onClick={() => decide.mutate('confirm')}
                  className={`${btn} bg-green-600 hover:bg-green-500`}
                >
                  Confirm
                </button>
                <button
                  type='button'
                  onClick={() => setEnding(true)}
                  className='text-xs text-red-600 hover:underline'
                >
                  End probation…
                </button>
              </>
            )}
            {r.can.decide && ending && (
              <>
                <button
                  type='button'
                  disabled={!noteOk || !lastDay || decide.isPending}
                  onClick={() => decide.mutate('end')}
                  className={`${btn} bg-red-600 hover:bg-red-500`}
                >
                  End and start the exit
                </button>
                <button
                  type='button'
                  onClick={() => setEnding(false)}
                  className='text-xs text-slate-400 hover:text-slate-600'
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {r.can.letter && (
        <button
          type='button'
          disabled={letter.isPending}
          onClick={() => letter.mutate()}
          className='text-xs text-brand-700 hover:underline'
        >
          Confirmation letter (PDF)
        </button>
      )}
    </li>
  );
};

/**
 * Reviews the caller can see: on My team (the RM recommends) and on HR →
 * People (HR confirms or ends). Shows the open ones plus the last few closed.
 */
export const ProbationReviews = ({ title, hr = false }: { title: string; hr?: boolean }) => {
  const reviews = useQuery({ queryKey: ['probation'], queryFn: probationApi.list });
  const list = reviews.data ?? [];
  const open = list.filter((r) => r.status === 'pending' || r.status === 'recommended');
  const closed = hr ? list.filter((r) => !open.includes(r)).slice(0, 5) : [];
  if (!reviews.error && open.length === 0 && closed.length === 0) return null;
  return (
    <section className='space-y-3 rounded-xl border border-violet-200 bg-violet-50/30 p-4'>
      <div>
        <h2 className='text-sm font-semibold text-slate-700'>{title}</h2>
        <p className='text-xs text-slate-500'>
          Two months, no extension. The RM recommends, HR decides; undecided reviews confirm by
          themselves 7 days after the date.
        </p>
      </div>
      {reviews.error && <p className='text-sm text-red-600'>{apiErrorMessage(reviews.error)}</p>}
      <ul className='space-y-2'>
        {[...open, ...closed].map((r) => (
          <ReviewRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
};

/** The employee's own probation: when it ends, where it stands, the letter. */
export const MyProbation = () => {
  const mine = useQuery({ queryKey: ['probation', 'mine'], queryFn: probationApi.mine });
  const letter = useMutation({ mutationFn: (id: string) => probationApi.letter(id) });
  const r = mine.data;
  if (!r) return null;
  return (
    <section className='rounded-xl border border-slate-200 bg-white p-4 text-sm'>
      <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Probation</h2>
      <p className='mt-1 text-slate-700'>
        {r.status === 'confirmed'
          ? `Confirmed${r.decidedAt ? ` on ${day(r.decidedAt)}` : ''}.`
          : r.status === 'ended'
            ? 'Your probation was ended — see Exit for the next steps.'
            : `Your probation ends on ${day(r.dueOn)}. Your manager and HR review it then.`}
      </p>
      {r.can.letter && (
        <button
          type='button'
          disabled={letter.isPending}
          onClick={() => letter.mutate(r.id)}
          className='mt-2 text-xs text-brand-700 hover:underline'
        >
          Download the confirmation letter
        </button>
      )}
      {letter.error && <p className='text-xs text-red-600'>{apiErrorMessage(letter.error)}</p>}
    </section>
  );
};

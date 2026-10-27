import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MyInterview } from '@app-types/api.types';
import {
  MODE_LABEL,
  ROUND_LABEL,
  SLOT_STATUS_LABEL,
  slotWhen,
} from '@constants/Common/hiring.constants';
import { roundScoreOf } from '@constants/Common/scorecardTemplate.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * Score one round on its sheet, as in the Excel: every attribute 1–4 with the
 * evidence for it, then a recommendation. The round score (out of 100) adds
 * up as you go. Final on submit.
 */
const ScoreForm = ({ item }: { item: MyInterview }) => {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<'hire' | 'no_hire' | ''>('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      candidatesApi.score(item.applicationId, item.round, {
        scores: item.attributes.map((a) => ({
          attribute: a.name,
          score: scores[a.name]!,
          evidence: evidence[a.name]?.trim() || undefined,
        })),
        recommendation: recommendation as 'hire' | 'no_hire',
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-interviews'] }),
  });
  const given = item.attributes.filter((a) => scores[a.name]);
  // "Do not hire" ends the candidacy at once, so it must say why (the rejection record).
  const complete =
    item.attributes.length > 0 &&
    given.length === item.attributes.length &&
    recommendation &&
    (recommendation === 'hire' || notes.trim());

  if (item.attributes.length === 0) {
    return (
      <p className='text-sm text-amber-700'>
        This round has no sheet on the scorecard yet — ask the recruiter to add it.
      </p>
    );
  }
  return (
    <div className='space-y-3'>
      <div className='overflow-hidden rounded-lg border border-slate-200'>
        {item.attributes.map((a, idx) => (
          <div
            key={a.name}
            className={`grid gap-2 p-3 sm:grid-cols-[1fr_auto] ${idx ? 'border-t border-slate-100' : ''}`}
          >
            <div className='space-y-1'>
              <p className='text-sm font-medium text-slate-800'>{a.name}</p>
              {a.questions.map((q, i) => (
                <p key={i} className='text-xs text-slate-500'>
                  • {q}
                </p>
              ))}
              <textarea
                value={evidence[a.name] ?? ''}
                onChange={(e) => setEvidence({ ...evidence, [a.name]: e.target.value })}
                rows={2}
                placeholder='Comments / evidence'
                className='mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none'
              />
            </div>
            <div className='flex items-start gap-1' role='radiogroup' aria-label={`Score for ${a.name}`}>
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type='button'
                  aria-pressed={scores[a.name] === n}
                  onClick={() => setScores({ ...scores, [a.name]: n })}
                  className={`h-8 w-8 rounded-md border text-sm ${
                    scores[a.name] === n
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className='text-sm text-slate-600'>
        Round score{' '}
        <span className='font-mono font-semibold text-slate-800'>
          {roundScoreOf(given.map((a) => scores[a.name]!))}
        </span>{' '}
        / 100 so far · {given.length} of {item.attributes.length} attributes scored
        {item.roundWeight !== null && <> · this round weighs {item.roundWeight}% of the total</>}
      </p>
      <div className='flex gap-4 text-sm text-slate-700'>
        {(['hire', 'no_hire'] as const).map((r) => (
          <label key={r} className='flex items-center gap-1.5'>
            <input
              type='radio'
              checked={recommendation === r}
              onChange={() => setRecommendation(r)}
            />
            {r === 'hire' ? 'Pass — move to the next round' : 'Do not hire — ends the candidacy'}
          </label>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder={
          recommendation === 'no_hire'
            ? 'Why not? Required — the candidate is rejected and this is kept on the record'
            : 'Overall notes for the panel (optional)'
        }
        className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
      />
      {save.error && <p className='text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
      <div className='flex justify-end gap-2'>
        {confirming && (
          <span className='self-center text-xs text-slate-500'>
            Scores are final once submitted.
          </span>
        )}
        <button
          type='button'
          disabled={!complete || save.isPending}
          onClick={() => (confirming ? save.mutate() : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50'
        >
          {confirming ? 'Confirm and submit' : 'Submit scores'}
        </button>
      </div>
    </div>
  );
};

type Tab = 'today' | 'upcoming' | 'unscheduled' | 'scored';

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const isLink = (v: string) => /^https?:\/\//i.test(v);

/** Where a round sits: scored, not yet given a time, today (or overdue), or later. */
const tabOf = (i: MyInterview, now: Date): Tab => {
  if (i.myScore) return 'scored';
  if (!i.slot || i.slot.status !== 'scheduled') return 'unscheduled';
  const at = new Date(i.slot.startsAt);
  return sameDay(at, now) || at < now ? 'today' : 'upcoming';
};

const TABS: Array<{ key: Tab; label: string; empty: string }> = [
  { key: 'today', label: 'Today', empty: 'No interviews today.' },
  { key: 'upcoming', label: 'Upcoming', empty: 'Nothing scheduled ahead.' },
  {
    key: 'unscheduled',
    label: 'Time not set',
    empty: 'Every round you conduct has a time.',
  },
  { key: 'scored', label: 'Scored', empty: 'Nothing scored yet.' },
];

/** When, how and where — the head of each interview card. */
const SlotLine = ({ item, now }: { item: MyInterview; now: Date }) => {
  const s = item.slot;
  if (!s || s.status !== 'scheduled') {
    return (
      <p className='text-xs text-slate-500'>
        {s ? `${SLOT_STATUS_LABEL[s.status]}${s.endReason ? ` — ${s.endReason}` : ''}. ` : ''}
        The recruiter hasn&apos;t set a time yet.
      </p>
    );
  }
  const at = new Date(s.startsAt);
  const overdue = at < now && !item.myScore;
  return (
    <div className='flex flex-wrap items-center gap-2 text-sm'>
      <span
        className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
          overdue ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'
        }`}
      >
        {slotWhen(s.startsAt)} · {s.durationMin} min
      </span>
      <span className='text-xs text-slate-600'>{MODE_LABEL[s.mode]}</span>
      {s.location &&
        (isLink(s.location) ? (
          <a
            href={s.location}
            target='_blank'
            rel='noreferrer'
            className='text-xs font-medium text-blue-700 underline'
          >
            Join the call
          </a>
        ) : (
          <span className='text-xs text-slate-600'>{s.location}</span>
        ))}
      {overdue && <span className='text-xs text-amber-700'>Waiting for your score</span>}
    </div>
  );
};

/**
 * Rounds I conduct: when each is (Today / Upcoming), the ones without a time
 * yet, and the ones I scored. Only my candidates and only my round's sheet —
 * never anyone else's scores.
 */
const MyInterviewsPage = () => {
  const list = useQuery({ queryKey: ['my-interviews'], queryFn: candidatesApi.myInterviews });
  const cv = useMutation({ mutationFn: (id: string) => candidatesApi.openCv(id) });
  const [tab, setTab] = useState<Tab>('today');
  const [scoring, setScoring] = useState<string | null>(null);

  if (list.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (list.error) return <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>;
  const now = new Date();
  const all = list.data ?? [];
  const byTab = (t: Tab) =>
    all
      .filter((i) => tabOf(i, now) === t)
      .sort((a, b) =>
        (a.slot?.startsAt ?? '9999').localeCompare(b.slot?.startsAt ?? '9999'),
      );
  const items = byTab(tab);
  const empty = TABS.find((t) => t.key === tab)!.empty;

  return (
    <div className='w-full space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>My interviews</h1>
        <p className='text-sm text-slate-500'>
          The rounds you conduct, with their times. You see only your own round&apos;s scorecard
          sheet.
        </p>
      </div>
      <div className='flex flex-wrap gap-1 border-b border-slate-200'>
        {TABS.map((t) => {
          const n = byTab(t.key).length;
          return (
            <button
              key={t.key}
              type='button'
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                tab === t.key
                  ? 'border-brand-600 font-medium text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {n > 0 && (
                <span className='ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600'>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {cv.error && <p className='text-sm text-red-600'>{apiErrorMessage(cv.error)}</p>}
      {items.length === 0 && (
        <p className='rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>
          {empty}
        </p>
      )}
      {items.map((i) => {
        const key = `${i.applicationId}:${i.round}`;
        return (
          <div key={key} className='space-y-3 rounded-xl border border-slate-200 bg-white p-4'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
              <div className='space-y-1'>
                <p className='font-medium text-slate-800'>{i.candidateName}</p>
                <p className='text-xs text-slate-400'>
                  {ROUND_LABEL[i.round]} round · {i.roleTitle} · {i.departmentName}
                </p>
                <p className='text-xs text-slate-500'>
                  {i.candidateEducation ?? 'Education not recorded'} ·{' '}
                  {i.candidateExperienceYears === null
                    ? 'experience not recorded'
                    : `${i.candidateExperienceYears} yrs experience`}
                </p>
              </div>
              {i.hasCv && (
                <button
                  type='button'
                  onClick={() => cv.mutate(i.candidateId)}
                  className='rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50'
                >
                  Open CV
                </button>
              )}
            </div>
            <SlotLine item={i} now={now} />
            {i.jdSummary && <p className='text-xs text-slate-500'>Role: {i.jdSummary}</p>}
            {i.myScore ? (
              <p className='text-sm text-slate-600'>
                Your score:{' '}
                <span className='font-mono font-semibold'>{i.myScore.roundScore}/100</span> ·{' '}
                {i.myScore.recommendation === 'hire' ? 'recommended hiring' : 'do not hire'}
              </p>
            ) : scoring === key ? (
              <ScoreForm item={i} />
            ) : (
              <button
                type='button'
                onClick={() => setScoring(key)}
                className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700'
              >
                Score this round ({i.attributes.length} attributes)
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MyInterviewsPage;

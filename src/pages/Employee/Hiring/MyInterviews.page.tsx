import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MyInterview } from '@app-types/api.types';
import { ROUND_LABEL } from '@constants/Common/hiring.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { apiErrorMessage } from '@utils/apiError';

/** Score one round: every criterion 1–5, a recommendation, notes. Final on submit. */
const ScoreForm = ({ item }: { item: MyInterview }) => {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<'hire' | 'no_hire' | ''>('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      candidatesApi.score(item.applicationId, item.round, {
        scores: item.criteria.map((c) => ({ criterion: c.criterion, score: scores[c.criterion]! })),
        recommendation: recommendation as 'hire' | 'no_hire',
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-interviews'] }),
  });
  const complete =
    item.criteria.length > 0 && item.criteria.every((c) => scores[c.criterion]) && recommendation;

  if (item.criteria.length === 0) {
    return (
      <p className='text-sm text-amber-700'>
        This round has no criteria on the scorecard yet — ask TA to add them.
      </p>
    );
  }
  return (
    <div className='space-y-3'>
      {item.criteria.map((c) => (
        <div key={c.criterion} className='space-y-1'>
          <p className='text-sm text-slate-800'>{c.criterion}</p>
          {c.guidance && <p className='text-xs text-slate-500'>{c.guidance}</p>}
          <div className='flex gap-1'>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type='button'
                onClick={() => setScores({ ...scores, [c.criterion]: n })}
                className={`h-8 w-8 rounded-md border text-sm ${
                  scores[c.criterion] === n
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
      <div className='flex gap-4 text-sm text-slate-700'>
        {(['hire', 'no_hire'] as const).map((r) => (
          <label key={r} className='flex items-center gap-1.5'>
            <input
              type='radio'
              checked={recommendation === r}
              onChange={() => setRecommendation(r)}
            />
            {r === 'hire' ? 'Recommend hiring' : 'Do not hire'}
          </label>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder='Notes for the panel'
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

/**
 * Rounds I conduct (TA Step D): only my candidates and my rounds — never
 * anyone else's scores. Scheduling happens in Calendly; scoring happens here.
 */
const MyInterviewsPage = () => {
  const list = useQuery({ queryKey: ['my-interviews'], queryFn: candidatesApi.myInterviews });
  const cv = useMutation({ mutationFn: (id: string) => candidatesApi.openCv(id) });

  if (list.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (list.error) return <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>;
  const pending = list.data?.filter((i) => !i.myScore) ?? [];
  const done = list.data?.filter((i) => i.myScore) ?? [];

  return (
    <div className='w-full space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>My interviews</h1>
        <p className='text-sm text-slate-500'>
          Score each round you conduct against the scorecard. You only see your own rounds.
        </p>
      </div>
      {cv.error && <p className='text-sm text-red-600'>{apiErrorMessage(cv.error)}</p>}
      {pending.length === 0 && (
        <p className='rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>
          Nothing to score right now.
        </p>
      )}
      {pending.map((i) => (
        <div
          key={`${i.applicationId}:${i.round}`}
          className='space-y-3 rounded-xl border border-slate-200 bg-white p-4'
        >
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <div>
              <p className='font-medium text-slate-800'>{i.candidateName}</p>
              <p className='text-xs text-slate-400'>
                {ROUND_LABEL[i.round]} · {i.roleTitle} · {i.departmentName}
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
          {i.jdSummary && <p className='text-xs text-slate-500'>Role: {i.jdSummary}</p>}
          <ScoreForm item={i} />
        </div>
      ))}
      {done.length > 0 && (
        <div className='space-y-2'>
          <h2 className='text-sm font-medium uppercase tracking-wide text-slate-500'>Scored</h2>
          {done.map((i) => (
            <div
              key={`${i.applicationId}:${i.round}`}
              className='rounded-lg border border-slate-200 bg-white p-3 text-sm'
            >
              <span className='font-medium text-slate-800'>{i.candidateName}</span>{' '}
              <span className='text-xs text-slate-400'>
                {ROUND_LABEL[i.round]} · {i.roleTitle}
              </span>
              <p className='text-xs text-slate-500'>
                {i.myScore!.average}/5 · {i.myScore!.recommendation === 'hire' ? 'hire' : 'no hire'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyInterviewsPage;

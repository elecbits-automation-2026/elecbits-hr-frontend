import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Application } from '@app-types/api.types';
import { ROUND_LABEL, STAGE_CLASS, STAGE_LABEL } from '@constants/Common/hiring.constants';
import HirePanel from '@components/Ta/Hiring/HirePanel.component';
import { candidatesApi } from '@services/api/candidates.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';

const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';
// Stages TA can still reject or record a withdrawal from (offers end in the hire panel).
const LIVE = ['sourced', 'shortlisted', 'interviewing', 'interviewed', 'decision', 'selected'];
const HIRE_STAGES = ['interviewed', 'decision', 'selected', 'offered', 'hired'];

/**
 * One candidate on one position: stage, each round's interviewer and score,
 * and TA's next move — shortlist (the line's TA RM only), start interviews, reject or
 * record a withdrawal (both need a reason). Scores are read-only here.
 */
const ApplicationRow = ({ app, showRole = false }: { app: Application; showRole?: boolean }) => {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isTaRm = !!me.data && app.taRmId === me.data.id;
  const [ending, setEnding] = useState<'reject' | 'withdraw' | null>(null);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['candidates'] });
    queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
  };
  const act = useMutation({
    mutationFn: (kind: 'shortlist' | 'start' | 'reject' | 'withdraw') =>
      kind === 'shortlist'
        ? candidatesApi.shortlist(app.id)
        : kind === 'start'
          ? candidatesApi.startInterviews(app.id)
          : kind === 'reject'
            ? candidatesApi.reject(app.id, reason.trim())
            : candidatesApi.withdraw(app.id, reason.trim()),
    onSuccess: () => {
      setEnding(null);
      setReason('');
      refresh();
    },
  });
  const scored = app.rounds.filter((r) => r.score).length;

  return (
    <div className='space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <button
          type='button'
          onClick={() => setOpen(!open)}
          className='text-left font-medium text-slate-800 hover:text-brand-600'
        >
          {showRole
            ? `${app.roleTitle} #${app.positionNumber} · ${app.departmentName}`
            : app.candidateName}
        </button>
        <span className='flex items-center gap-2'>
          {(app.stage === 'interviewing' || app.stage === 'interviewed') && (
            <span className='text-xs text-slate-400'>
              {scored}/{app.rounds.length} rounds scored
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_CLASS[app.stage]}`}
          >
            {STAGE_LABEL[app.stage]}
          </span>
        </span>
      </div>
      {app.outcomeReason && !LIVE.includes(app.stage) && (
        <p className='text-xs text-slate-500'>Reason: {app.outcomeReason}</p>
      )}
      {open && (
        <ul className='space-y-1.5'>
          {app.rounds.map((r) => (
            <li key={r.round} className='rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600'>
              <span className='font-medium'>{ROUND_LABEL[r.round]}</span> ·{' '}
              {r.interviewerName ?? 'no interviewer yet'}
              {r.score ? (
                <span
                  className={
                    r.score.recommendation === 'hire' ? 'text-emerald-700' : 'text-red-600'
                  }
                >
                  {' '}
                  · {r.score.average}/5 · {r.score.recommendation === 'hire' ? 'hire' : 'no hire'}
                </span>
              ) : (
                ' · not scored'
              )}
              {r.score && (
                <p className='mt-0.5 text-slate-500'>
                  {r.score.scores.map((s) => `${s.criterion} ${s.score}`).join(' · ')}
                  {r.score.notes && ` — ${r.score.notes}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {ending && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder={
            ending === 'reject' ? 'Why is this candidate rejected?' : 'Why did they withdraw?'
          }
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
        />
      )}
      {HIRE_STAGES.includes(app.stage) && <HirePanel app={app} />}
      {act.error && <p className='text-xs text-red-600'>{apiErrorMessage(act.error)}</p>}
      {LIVE.includes(app.stage) && (
        <div className='flex flex-wrap justify-end gap-2'>
          {ending ? (
            <>
              <button type='button' onClick={() => setEnding(null)} className={btn}>
                Back
              </button>
              <button
                type='button'
                disabled={!reason.trim() || act.isPending}
                onClick={() => act.mutate(ending)}
                className='rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50'
              >
                {ending === 'reject' ? 'Reject' : 'Record withdrawal'}
              </button>
            </>
          ) : (
            <>
              <button type='button' onClick={() => setEnding('withdraw')} className={btn}>
                Withdrew
              </button>
              <button type='button' onClick={() => setEnding('reject')} className={btn}>
                Reject
              </button>
              {app.stage === 'sourced' && isTaRm && (
                <button
                  type='button'
                  disabled={act.isPending}
                  onClick={() => act.mutate('shortlist')}
                  className='rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50'
                >
                  Validate shortlist
                </button>
              )}
              {app.stage === 'sourced' && !isTaRm && (
                <span className='self-center text-xs text-slate-400'>
                  Waiting for the TA RM’s shortlist
                </span>
              )}
              {app.stage === 'shortlisted' && (
                <button
                  type='button'
                  disabled={act.isPending}
                  onClick={() => act.mutate('start')}
                  className='rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50'
                >
                  Start interviews
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplicationRow;

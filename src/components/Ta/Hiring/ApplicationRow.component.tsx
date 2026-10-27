import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Application } from '@app-types/api.types';
import { ROUND_LABEL, STAGE_CLASS, STAGE_LABEL } from '@constants/Common/hiring.constants';
import HirePanel from '@components/Ta/Hiring/HirePanel.component';
import RoundSchedule from '@components/Ta/Hiring/RoundSchedule.component';
import { candidatesApi } from '@services/api/candidates.api';
import { meApi } from '@services/api/me.api';
import ScorecardSummary from '@components/Common/Hiring/ScorecardSummary.component';
import { apiErrorMessage } from '@utils/apiError';

const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';
// Stages TA can still reject or record a withdrawal from (offers end in the hire panel).
const LIVE = ['sourced', 'shortlisted', 'interviewing', 'interviewed', 'decision', 'selected'];
const HIRE_STAGES = ['interviewed', 'decision', 'selected', 'offered', 'hired', 'joined'];

/**
 * One candidate on one position: stage, each round's interviewer and score,
 * and TA's next move — start the screening (round 1, the gate), reject or
 * record a withdrawal (both need a reason). Scores are read-only here.
 */
const ApplicationRow = ({
  app,
  showRole = false,
  defaultOpen = false,
  showSummary = true,
}: {
  app: Application;
  showRole?: boolean;
  /** Start with the scorecard summary open. */
  defaultOpen?: boolean;
  /** False where the summary is already shown above (the candidate panel). */
  showSummary?: boolean;
}) => {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isTaRm = !!me.data && app.taRmId === me.data.id;
  const canSchedule = isTaRm || (!!me.data && app.recruiterId === me.data.id);
  const [ending, setEnding] = useState<'reject' | 'withdraw' | null>(null);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(defaultOpen);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['candidates'] });
    queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
  };
  const act = useMutation({
    mutationFn: (kind: 'informed' | 'start' | 'reject' | 'withdraw') =>
      kind === 'informed'
        ? candidatesApi.informed(app.id)
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
        <span className='font-medium text-slate-800'>
          {showRole
            ? `${app.roleTitle} #${app.positionNumber} · ${app.departmentName}`
            : app.candidateName}
        </span>
        <span className='flex items-center gap-2'>
          {showSummary && (
            <button
              type='button'
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className='rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
            >
              Scorecard {open ? '▴' : '▾'}
            </button>
          )}
          {(app.stage === 'interviewing' || app.stage === 'interviewed') && (
            <span className='text-xs text-slate-400'>
              {app.currentRound && <>Now: {ROUND_LABEL[app.currentRound]} · </>}
              {scored}/{app.rounds.length} rounds passed
              {app.scoreTotal !== null && ` · ${app.scoreTotal}/100`}
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
        <div className='flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600'>
          <span>
            {app.stage === 'rejected' && (
              <>
                Rejected
                {app.rejectedRound && <> in {ROUND_LABEL[app.rejectedRound]}</>}
                {app.rejectedByName && <> by {app.rejectedByName}</>}:{' '}
              </>
            )}
            {app.outcomeReason}
          </span>
          {(app.stage === 'rejected' || app.stage === 'withdrawn') &&
            (app.informedAt ? (
              <span className='text-emerald-700'>
                ✓ Candidate informed {new Date(app.informedAt).toLocaleDateString('en-IN')}
              </span>
            ) : (
              canSchedule && (
                <button
                  type='button'
                  disabled={act.isPending}
                  onClick={() => act.mutate('informed')}
                  className={btn}
                >
                  Mark candidate informed
                </button>
              )
            ))}
        </div>
      )}
      {(app.stage === 'interviewing' || (open && app.stage === 'interviewed')) && (
        <RoundSchedule app={app} canSchedule={canSchedule} />
      )}
      {showSummary && open && <ScorecardSummary app={app} />}
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
      {HIRE_STAGES.includes(app.stage) && <HirePanel app={app} canWork={canSchedule} />}
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
              {(app.stage === 'sourced' || app.stage === 'shortlisted') && canSchedule && (
                <button
                  type='button'
                  disabled={act.isPending}
                  onClick={() => act.mutate('start')}
                  className='rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50'
                >
                  Start screening (round 1)
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

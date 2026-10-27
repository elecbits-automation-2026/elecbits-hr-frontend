import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Application } from '@app-types/api.types';
import { DecisionStatus } from '@components/Ta/Hiring/HirePanel.component';
import { ROUND_LABEL } from '@constants/Common/hiring.constants';
import { hireApi } from '@services/api/hire.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * One final hire decision for a decider (dept head, line's TA RM, HR head, Admin):
 * every round's scores — visible only while the decision is pending — and
 * approve / reject. A reject ends the application.
 */
const HireDecisionCard = ({ app }: { app: Application }) => {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const go = useMutation({
    mutationFn: (decision: 'approve' | 'reject') =>
      hireApi.decide(app.id, {
        decision,
        reason: decision === 'reject' ? reason.trim() : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hire-decisions'] }),
  });
  return (
    <div className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
      <div>
        <p className='font-medium text-slate-800'>{app.candidateName}</p>
        <p className='text-xs text-slate-400'>
          {app.roleTitle} #{app.positionNumber} · {app.departmentName}
        </p>
      </div>
      <ul className='space-y-1.5'>
        {app.rounds.map((r) => (
          <li key={r.round} className='rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600'>
            <span className='font-medium'>{ROUND_LABEL[r.round]}</span> · {r.interviewerName}
            {r.score && (
              <>
                <span
                  className={
                    r.score.recommendation === 'hire' ? 'text-emerald-700' : 'text-red-600'
                  }
                >
                  {' '}
                  · {r.score.average}/5 · {r.score.recommendation === 'hire' ? 'hire' : 'no hire'}
                </span>
                <p className='mt-0.5 text-slate-500'>
                  {r.score.scores.map((s) => `${s.criterion} ${s.score}`).join(' · ')}
                  {r.score.notes && ` — ${r.score.notes}`}
                </p>
              </>
            )}
          </li>
        ))}
      </ul>
      <DecisionStatus app={app} />
      {rejecting && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder='Why not this candidate?'
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
        />
      )}
      {go.error && <p className='text-sm text-red-600'>{apiErrorMessage(go.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button
          type='button'
          onClick={() => setRejecting(!rejecting)}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
        >
          {rejecting ? 'Back' : 'Reject'}
        </button>
        {rejecting ? (
          <button
            type='button'
            disabled={!reason.trim() || go.isPending}
            onClick={() => go.mutate('reject')}
            className='rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50'
          >
            Do not hire
          </button>
        ) : (
          <button
            type='button'
            disabled={go.isPending}
            onClick={() => go.mutate('approve')}
            className='rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50'
          >
            Approve the hire
          </button>
        )}
      </div>
    </div>
  );
};

export default HireDecisionCard;

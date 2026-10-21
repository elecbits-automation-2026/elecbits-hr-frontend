import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Pip, PipRating } from '@app-types/api.types';
import { pipApi } from '@services/api/pip.api';
import { apiErrorMessage } from '@utils/apiError';

const PIP_STATUS: Record<Pip['status'], { label: string; cls: string }> = {
  pending_hr: { label: 'waiting on HR', cls: 'bg-amber-50 text-amber-800' },
  active: { label: 'active', cls: 'bg-blue-50 text-blue-700' },
  passed: { label: 'passed', cls: 'bg-green-50 text-green-700' },
  not_passed: { label: 'not passed', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'withdrawn', cls: 'bg-slate-100 text-slate-500' },
};

const RATING: Record<PipRating, { label: string; cls: string }> = {
  on_track: { label: 'on track', cls: 'text-green-700' },
  at_risk: { label: 'at risk', cls: 'text-amber-700' },
  off_track: { label: 'off track', cls: 'text-red-700' },
};

const day = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const inputClass =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none';
const btn = 'rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40';

/**
 * One PIP: targets, support, check-ins, and whatever the viewer may do next
 * (the server's `can`): HR approves, the employee acknowledges, the RM logs
 * a check-in every two weeks and records the outcome at the end.
 */
const PipCard = ({ pip, showPerson = false }: { pip: Pip; showPerson?: boolean }) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<PipRating>('on_track');
  const [panel, setPanel] = useState<'none' | 'checkin' | 'outcome' | 'cancel' | 'decline'>(
    'none',
  );
  const done = () => {
    setNote('');
    setPanel('none');
    void queryClient.invalidateQueries({ queryKey: ['pips'] });
  };
  const act = useMutation({
    mutationFn: (fn: () => Promise<Pip>) => fn(),
    onSuccess: done,
  });
  const look = PIP_STATUS[pip.status];
  const noteOk = note.trim().length >= 5;

  return (
    <div className='space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        {showPerson && <span className='font-medium text-slate-800'>{pip.employee.name}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs ${look.cls}`}>{look.label}</span>
        <span className='text-xs text-slate-500'>
          {day(pip.startOn)} → {day(pip.endOn)}
          {pip.extended ? ' (extended 30 days)' : ''} · RM {pip.rm.name}
        </span>
        {pip.status === 'active' && pip.nextCheckinOn && (
          <span className='ml-auto text-xs text-slate-500'>
            Next check-in {day(pip.nextCheckinOn)}
          </span>
        )}
      </div>

      <div>
        <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Why</p>
        <p className='whitespace-pre-line text-slate-700'>{pip.reason}</p>
      </div>
      <div>
        <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Targets</p>
        <ol className='list-decimal space-y-1 pl-5 text-slate-700'>
          {pip.targets.map((t, i) => (
            <li key={i}>
              {t.title} <span className='text-slate-400'>— measured by {t.measure}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Support</p>
        <p className='whitespace-pre-line text-slate-700'>{pip.support}</p>
      </div>

      <p className='text-xs text-slate-500'>
        {pip.hrBy ? `HR: ${pip.hrBy.name}${pip.hrNote ? ` — ${pip.hrNote}` : ''}` : 'HR has not approved yet'}
        {' · '}
        {pip.acknowledgedAt
          ? `acknowledged ${day(pip.acknowledgedAt)}`
          : 'not acknowledged by the employee yet'}
      </p>

      {pip.checkins.length > 0 && (
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
            Check-ins
          </p>
          <ul className='space-y-1'>
            {pip.checkins.map((c) => (
              <li key={c.id} className='text-slate-700'>
                <span className='text-xs text-slate-400'>{day(c.on)} · </span>
                <span className={`text-xs font-medium ${RATING[c.rating].cls}`}>
                  {RATING[c.rating].label}
                </span>{' '}
                — {c.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pip.outcomeNote && (
        <p className='rounded-md bg-slate-50 p-2 text-slate-700'>
          Outcome{pip.outcomeBy ? ` (${pip.outcomeBy.name})` : ''}: {pip.outcomeNote}
        </p>
      )}

      {act.error && <p className='text-xs text-red-600'>{apiErrorMessage(act.error)}</p>}

      {panel === 'none' && (
        <div className='flex flex-wrap gap-2'>
          {pip.can.decide && (
            <>
              <button
                type='button'
                disabled={act.isPending}
                onClick={() => act.mutate(() => pipApi.decide(pip.id, { approve: true }))}
                className={`${btn} bg-green-600 hover:bg-green-500`}
              >
                Approve PIP
              </button>
              <button
                type='button'
                onClick={() => setPanel('decline')}
                className='text-xs text-red-600 hover:underline'
              >
                Send back
              </button>
            </>
          )}
          {pip.can.acknowledge && (
            <button
              type='button'
              disabled={act.isPending}
              onClick={() => act.mutate(() => pipApi.acknowledge(pip.id))}
              className={`${btn} bg-brand-600 hover:bg-brand-500`}
            >
              I have read this plan
            </button>
          )}
          {pip.can.checkin && (
            <button
              type='button'
              onClick={() => setPanel('checkin')}
              className={`${btn} bg-brand-600 hover:bg-brand-500`}
            >
              Log a check-in
            </button>
          )}
          {pip.can.outcome && (
            <button
              type='button'
              onClick={() => setPanel('outcome')}
              className={`${btn} bg-slate-700 hover:bg-slate-600`}
            >
              Record the outcome
            </button>
          )}
          {pip.can.cancel && (
            <button
              type='button'
              onClick={() => setPanel('cancel')}
              className='text-xs text-slate-500 hover:underline'
            >
              Withdraw
            </button>
          )}
        </div>
      )}

      {panel !== 'none' && (
        <div className='space-y-2 rounded-md bg-slate-50 p-3'>
          {panel === 'checkin' && (
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value as PipRating)}
              className={inputClass}
            >
              <option value='on_track'>On track</option>
              <option value='at_risk'>At risk</option>
              <option value='off_track'>Off track</option>
            </select>
          )}
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              panel === 'checkin'
                ? 'Progress against each target since the last check-in'
                : panel === 'outcome'
                  ? 'How the plan went (the employee sees this)'
                  : panel === 'decline'
                    ? 'What should change before HR approves'
                    : 'Why it is being withdrawn'
            }
            className={inputClass}
          />
          <div className='flex flex-wrap gap-2'>
            {panel === 'checkin' && (
              <button
                type='button'
                disabled={!noteOk || act.isPending}
                onClick={() => act.mutate(() => pipApi.checkin(pip.id, { rating, note: note.trim() }))}
                className={`${btn} bg-brand-600 hover:bg-brand-500`}
              >
                Save check-in
              </button>
            )}
            {panel === 'outcome' && (
              <>
                <button
                  type='button'
                  disabled={!noteOk || act.isPending}
                  onClick={() =>
                    act.mutate(() => pipApi.outcome(pip.id, { outcome: 'passed', note: note.trim() }))
                  }
                  className={`${btn} bg-green-600 hover:bg-green-500`}
                >
                  Passed
                </button>
                {!pip.extended && (
                  <button
                    type='button'
                    disabled={!noteOk || act.isPending}
                    onClick={() =>
                      act.mutate(() => pipApi.outcome(pip.id, { outcome: 'extend', note: note.trim() }))
                    }
                    className={`${btn} bg-amber-600 hover:bg-amber-500`}
                  >
                    Extend 30 days (once)
                  </button>
                )}
                <button
                  type='button'
                  disabled={!noteOk || act.isPending}
                  onClick={() =>
                    act.mutate(() =>
                      pipApi.outcome(pip.id, { outcome: 'not_passed', note: note.trim() }),
                    )
                  }
                  className={`${btn} bg-red-600 hover:bg-red-500`}
                >
                  Not passed
                </button>
              </>
            )}
            {panel === 'decline' && (
              <button
                type='button'
                disabled={act.isPending}
                onClick={() =>
                  act.mutate(() =>
                    pipApi.decide(pip.id, {
                      approve: false,
                      ...(note.trim() ? { note: note.trim() } : {}),
                    }),
                  )
                }
                className={`${btn} bg-red-600 hover:bg-red-500`}
              >
                Send back
              </button>
            )}
            {panel === 'cancel' && (
              <button
                type='button'
                disabled={note.trim().length < 3 || act.isPending}
                onClick={() => act.mutate(() => pipApi.cancel(pip.id, note.trim()))}
                className={`${btn} bg-red-600 hover:bg-red-500`}
              >
                Withdraw the PIP
              </button>
            )}
            <button
              type='button'
              onClick={() => setPanel('none')}
              className='text-xs text-slate-400 hover:text-slate-600'
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipCard;

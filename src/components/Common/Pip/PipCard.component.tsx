import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Pip } from '@app-types/api.types';
import { pipApi } from '@services/api/pip.api';
import { apiErrorMessage } from '@utils/apiError';

const PIP_STATUS: Record<Pip['status'], { label: string; cls: string }> = {
  pending_hr: { label: 'waiting on HR', cls: 'bg-amber-50 text-amber-800' },
  active: { label: 'active', cls: 'bg-blue-50 text-blue-700' },
  passed: { label: 'passed', cls: 'bg-green-50 text-green-700' },
  not_passed: { label: 'not passed', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'withdrawn', cls: 'bg-slate-100 text-slate-500' },
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
 * One PIP: why, targets, support, and whatever the viewer may do next (the
 * server's `can`): once the 60 days are over the RM records the outcome; the
 * RM or HR may withdraw it while it runs. No approval, acknowledgement or
 * check-ins (learner, 2026-11-05).
 */
const PipCard = ({ pip, showPerson = false }: { pip: Pip; showPerson?: boolean }) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [panel, setPanel] = useState<'none' | 'outcome' | 'cancel'>('none');
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

      {pip.outcomeNote && (
        <p className='rounded-md bg-slate-50 p-2 text-slate-700'>
          Outcome{pip.outcomeBy ? ` (${pip.outcomeBy.name})` : ''}: {pip.outcomeNote}
        </p>
      )}

      {act.error && <p className='text-xs text-red-600'>{apiErrorMessage(act.error)}</p>}

      {panel === 'none' && (pip.can.outcome || pip.can.cancel) && (
        <div className='flex flex-wrap gap-2'>
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
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              panel === 'outcome'
                ? 'How the plan went (the employee sees this)'
                : 'Why it is being withdrawn'
            }
            className={inputClass}
          />
          <div className='flex flex-wrap gap-2'>
            {panel === 'outcome' && (
              <>
                <button
                  type='button'
                  disabled={!noteOk || act.isPending}
                  onClick={() =>
                    act.mutate(() =>
                      pipApi.outcome(pip.id, { outcome: 'passed', note: note.trim() }),
                    )
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
                      act.mutate(() =>
                        pipApi.outcome(pip.id, { outcome: 'extend', note: note.trim() }),
                      )
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

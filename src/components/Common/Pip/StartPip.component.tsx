import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { pipApi } from '@services/api/pip.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none';

/**
 * The RM opens a PIP: why, measurable targets, the support offered, and a
 * start date. 60 days, a check-in every 2 weeks; HR approves before it runs.
 */
const StartPip = ({ employeeId, onDone }: { employeeId: string; onDone: () => void }) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [support, setSupport] = useState('');
  const [startOn, setStartOn] = useState(new Date().toLocaleDateString('en-CA'));
  const [targets, setTargets] = useState([{ title: '', measure: '' }]);
  const create = useMutation({
    mutationFn: () =>
      pipApi.create({
        employeeId,
        reason: reason.trim(),
        support: support.trim(),
        startOn,
        targets: targets
          .map((t) => ({ title: t.title.trim(), measure: t.measure.trim() }))
          .filter((t) => t.title || t.measure),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pips'] });
      onDone();
    },
  });
  const filled = targets.filter((t) => t.title.trim().length >= 3 && t.measure.trim().length >= 3);
  const ready =
    reason.trim().length >= 10 && support.trim().length >= 10 && filled.length >= 1 && !!startOn;
  const setTarget = (i: number, key: 'title' | 'measure', v: string) =>
    setTargets(targets.map((t, j) => (j === i ? { ...t, [key]: v } : t)));

  return (
    <div className='space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm'>
      <p className='text-xs text-slate-500'>
        60 days with a check-in every 2 weeks. HR approves it before it starts; they then
        acknowledge it.
      </p>
      <label className='block text-xs font-medium text-slate-600'>
        Why a PIP
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className='space-y-2'>
        <p className='text-xs font-medium text-slate-600'>Targets (measurable)</p>
        {targets.map((t, i) => (
          <div key={i} className='flex flex-wrap gap-2'>
            <input
              value={t.title}
              onChange={(e) => setTarget(i, 'title', e.target.value)}
              placeholder='Target'
              className={`min-w-[12rem] flex-1 ${inputClass}`}
            />
            <input
              value={t.measure}
              onChange={(e) => setTarget(i, 'measure', e.target.value)}
              placeholder='How it is measured'
              className={`min-w-[12rem] flex-1 ${inputClass}`}
            />
            {targets.length > 1 && (
              <button
                type='button'
                onClick={() => setTargets(targets.filter((_, j) => j !== i))}
                className='text-xs text-slate-400 hover:text-red-600'
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {targets.length < 10 && (
          <button
            type='button'
            onClick={() => setTargets([...targets, { title: '', measure: '' }])}
            className='text-xs text-brand-700 hover:underline'
          >
            + Add a target
          </button>
        )}
      </div>
      <label className='block text-xs font-medium text-slate-600'>
        Support you will give
        <textarea
          rows={2}
          value={support}
          onChange={(e) => setSupport(e.target.value)}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className='block text-xs font-medium text-slate-600'>
        Starts on
        <input
          type='date'
          value={startOn}
          onChange={(e) => setStartOn(e.target.value)}
          className={`mt-1 w-44 ${inputClass}`}
        />
      </label>
      {create.error && <p className='text-xs text-red-600'>{apiErrorMessage(create.error)}</p>}
      <div className='flex gap-2'>
        <button
          type='button'
          disabled={!ready || create.isPending}
          onClick={() => create.mutate()}
          className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40'
        >
          Send to HR for approval
        </button>
        <button type='button' onClick={onDone} className='text-xs text-slate-400 hover:text-slate-600'>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default StartPip;

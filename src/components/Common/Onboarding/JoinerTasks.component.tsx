import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboardingApi } from '@services/api/onboarding.api';
import { apiErrorMessage } from '@utils/apiError';

const COPY = {
  ops: {
    title: 'New joiners — assets to issue',
    hint: 'You decide what each joiner gets (laptop, desktop, mobile, ID card…). Issue them from Assets, then mark this done with what you gave.',
  },
  payroll: {
    title: 'New joiners — salary and bank details',
    hint: 'Ticks itself once the CTC and bank details are saved under Compensation — it can’t be ticked by hand.',
  },
} as const;

/** OPS / payroll's share of the onboarding checklist: open joiner tasks. */
const JoinerTasks = ({ owner }: { owner: 'ops' | 'payroll' }) => {
  const queryClient = useQueryClient();
  // OPS marks a joiner done with a note of what was issued (proof).
  const [noting, setNoting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const tasks = useQuery({
    queryKey: ['onboarding-team-tasks', owner],
    queryFn: () => onboardingApi.teamTasks(owner),
  });
  const toggle = useMutation({
    mutationFn: ({ taskId, note }: { taskId: string; note: string }) =>
      onboardingApi.toggleTask(taskId, note),
    onSuccess: () => {
      setNoting(null);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['onboarding-team-tasks', owner] });
    },
  });
  const open = (tasks.data ?? []).filter((t) => !t.done);
  if (!tasks.error && open.length === 0) return null;
  const copy = COPY[owner];
  return (
    <section className='space-y-2 rounded-xl border border-violet-200 bg-violet-50/30 p-4'>
      <div>
        <h2 className='text-sm font-semibold text-slate-700'>{copy.title}</h2>
        <p className='text-xs text-slate-500'>{copy.hint}</p>
      </div>
      {(tasks.error || toggle.error) && (
        <p className='text-sm text-red-600'>{apiErrorMessage(tasks.error ?? toggle.error)}</p>
      )}
      <ul className='space-y-1'>
        {open.map((t) => (
          <li
            key={t.taskId}
            className='flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm'
          >
            <span className='font-medium text-slate-800'>{t.employee.name}</span>
            <span className='text-xs text-slate-400'>
              {t.employee.designation ?? t.employee.employeeCode}
              {t.employee.dateOfJoining ? ` · joins ${t.employee.dateOfJoining}` : ''}
            </span>
            <span className='text-xs text-slate-500'>{t.title}</span>
            {owner === 'payroll' ? (
              // No hand tick: it completes when the CTC + bank details are saved.
              <span className='ml-auto text-xs text-amber-700'>Waiting for CTC and bank details</span>
            ) : noting === t.taskId ? (
              <span className='ml-auto flex flex-wrap items-center gap-2 text-xs'>
                <input
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder='What was issued? e.g. laptop EB-LAP-0012, ID card'
                  className='w-72 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none'
                />
                <button
                  type='button'
                  disabled={note.trim().length < 3 || toggle.isPending}
                  onClick={() => toggle.mutate({ taskId: t.taskId, note: note.trim() })}
                  className='font-medium text-brand-600 hover:underline disabled:opacity-40'
                >
                  Mark done
                </button>
                <button type='button' onClick={() => setNoting(null)} className='text-slate-400 hover:text-slate-600'>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type='button'
                onClick={() => {
                  setNoting(t.taskId);
                  setNote('');
                }}
                className='ml-auto text-xs font-medium text-brand-600 hover:underline'
              >
                Mark done
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default JoinerTasks;

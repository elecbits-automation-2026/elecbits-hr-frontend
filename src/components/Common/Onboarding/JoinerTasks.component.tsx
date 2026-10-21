import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboardingApi } from '@services/api/onboarding.api';
import { apiErrorMessage } from '@utils/apiError';

const COPY = {
  ops: {
    title: 'New joiners — kit to issue',
    hint: 'Ticks itself once every kit line is held by the joiner; tick by hand when issued outside the register.',
  },
  payroll: {
    title: 'New joiners — salary and bank details',
    hint: 'Ticks itself once the CTC and bank details are on the compensation record.',
  },
} as const;

/** OPS / payroll's share of the onboarding checklist: open joiner tasks. */
const JoinerTasks = ({ owner }: { owner: 'ops' | 'payroll' }) => {
  const queryClient = useQueryClient();
  const tasks = useQuery({
    queryKey: ['onboarding-team-tasks', owner],
    queryFn: () => onboardingApi.teamTasks(owner),
  });
  const toggle = useMutation({
    mutationFn: (taskId: string) => onboardingApi.toggleTask(taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['onboarding-team-tasks', owner] }),
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
            <button
              type='button'
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(t.taskId)}
              className='ml-auto text-xs font-medium text-brand-700 hover:underline disabled:opacity-50'
            >
              Mark done
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default JoinerTasks;

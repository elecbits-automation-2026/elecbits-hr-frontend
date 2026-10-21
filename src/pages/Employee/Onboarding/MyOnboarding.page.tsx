import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OnboardingTask } from '@app-types/api.types';
import OnboardingChecklist from '@components/Common/Onboarding/OnboardingChecklist.component';
import { MyProbation } from '@components/Common/Probation/Probation.component';
import { onboardingApi } from '@services/api/onboarding.api';
import { apiErrorMessage } from '@utils/apiError';

/** Own onboarding: the three-phase checklist, with "who are you waiting on". */
const MyOnboardingPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-onboarding'],
    queryFn: onboardingApi.mine,
  });

  const toggle = useMutation({
    mutationFn: (task: OnboardingTask) => onboardingApi.toggleTask(task.id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] });
    },
  });

  if (isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (error) return <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>;

  if (!data) {
    return (
      <div className='w-full space-y-4'>
        <h1 className='text-2xl font-semibold text-slate-800'>Onboarding</h1>
        <MyProbation />
        <p className='text-sm text-slate-500'>
          Onboarding does not apply to your record — you joined before this checklist existed. If
          that looks wrong, ask HR to start a journey for you.
        </p>
      </div>
    );
  }

  // The first open step that is NOT yours, and the next one that is.
  const pending = data.tasks.filter((t) => !t.done);
  const waitingOn = pending.find((t) => t.owner !== 'employee');
  const nextMine = pending.find((t) => t.owner === 'employee');

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Onboarding</h1>
        <span className='text-sm text-slate-500'>
          {data.progress.done}/{data.progress.total} done · started {data.startedOn}
        </span>
      </div>
      <MyProbation />

      {data.status === 'done' ? (
        <p className='rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800'>
          All done — welcome aboard.
        </p>
      ) : (
        (waitingOn || nextMine) && (
          <div className='rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
            {waitingOn && (
              <>
                Waiting on{' '}
                <span className='font-medium'>
                  {waitingOn.owner === 'hr' ? 'HR' : waitingOn.owner === 'manager' ? 'your manager' : 'admin'}
                </span>{' '}
                — “{waitingOn.title}”.{' '}
              </>
            )}
            {nextMine && (
              <>
                {waitingOn ? 'Meanwhile the next one on you is' : 'Next on you:'}{' '}
                <span className='font-medium'>“{nextMine.title}”</span>.
              </>
            )}
          </div>
        )
      )}

      {toggle.error && <p className='text-sm text-red-600'>{apiErrorMessage(toggle.error)}</p>}

      <OnboardingChecklist
        journey={data}
        canTick={(t) => t.owner === 'employee' && !t.policyCode}
        onToggle={(t) => toggle.mutate(t)}
        ticking={toggle.isPending}
      />
    </div>
  );
};

export default MyOnboardingPage;

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { OnboardingJourney } from '@app-types/api.types';
import OnboardingChecklist from '@components/Common/Onboarding/OnboardingChecklist.component';
import { MyProbation } from '@components/Common/Probation/Probation.component';
import { onboardingApi } from '@services/api/onboarding.api';
import { apiErrorMessage } from '@utils/apiError';

const tabBtn = (on: boolean) =>
  `rounded-full px-3 py-1 text-sm ${
    on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`;

/** "Me": the joiner's own three-phase checklist, with who they wait on. */
const Mine = ({ data, onChanged }: { data: OnboardingJourney | null; onChanged: () => void }) => {
  if (!data) {
    return (
      <p className='text-sm text-slate-500'>
        Onboarding does not apply to your record — you joined before this checklist existed. If
        that looks wrong, ask HR to start a journey for you.
      </p>
    );
  }
  // The first open step that is NOT yours, and the next one that is.
  const pending = data.tasks.filter((t) => !t.done);
  const waitingOn = pending.find((t) => t.owner !== 'employee' && !t.auto);
  const nextMine = pending.find((t) => t.owner === 'employee' && !t.auto);
  const who = (o: string) =>
    o === 'hr' ? 'HR' : o === 'manager' ? 'your manager' : o === 'ops' ? 'OPS' : o === 'payroll' ? 'payroll' : 'admin';

  return (
    <div className='space-y-4'>
      <p className='text-sm text-slate-500'>
        {data.progress.done}/{data.progress.total} done · started {data.startedOn}
      </p>
      {data.status === 'done' ? (
        <p className='rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800'>
          All done — welcome aboard.
        </p>
      ) : (
        (waitingOn || nextMine) && (
          <div className='rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
            {waitingOn && (
              <>
                Waiting on <span className='font-medium'>{who(waitingOn.owner)}</span> — “
                {waitingOn.title}”.{' '}
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
      <OnboardingChecklist journey={data} selfView onChanged={onChanged} />
    </div>
  );
};

/** "My team": the RM's joiners — their checklists, with the manager steps to tick. */
const MyTeam = ({ team, onChanged }: { team: OnboardingJourney[]; onChanged: () => void }) => {
  const [openId, setOpenId] = useState<string | null>(team.find((j) => j.status === 'open')?.id ?? null);
  return (
    <div className='space-y-3'>
      <p className='text-sm text-slate-500'>
        Your joiners. You tick the manager steps (team intro, buddy, tools walkthrough,
        first-quarter expectations) with a short note of what was done.
      </p>
      {team.map((j) => {
        const mine = j.tasks.filter((t) => t.canAct && !t.done).length;
        const open = openId === j.id;
        return (
          <div key={j.id} className='rounded-xl border border-slate-200 bg-white'>
            <button
              type='button'
              onClick={() => setOpenId(open ? null : j.id)}
              className='flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left'
            >
              <span className='font-medium text-slate-800'>
                {j.employee.name}
                <span className='ml-2 font-mono text-xs text-slate-400'>{j.employee.employeeCode}</span>
              </span>
              <span className='flex items-center gap-3 text-xs text-slate-500'>
                {mine > 0 && (
                  <span className='rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800'>
                    {mine} waiting on you
                  </span>
                )}
                {j.progress.done}/{j.progress.total} done · started {j.startedOn}
                <span>{open ? '▴' : '▾'}</span>
              </span>
            </button>
            {open && (
              <div className='border-t border-slate-100 p-4'>
                <OnboardingChecklist journey={j} onChanged={onChanged} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Onboarding: my own checklist, and — for RMs — a "My team" tab for their joiners. */
const MyOnboardingPage = () => {
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-onboarding'], queryFn: onboardingApi.mine });
  const team = useQuery({ queryKey: ['team-onboarding'], queryFn: onboardingApi.team });
  const hasTeam = (team.data?.length ?? 0) > 0;
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  // With no journey of my own but joiners to look after, open on My team.
  const view = tab === 'mine' && !mine.data && hasTeam ? 'team' : tab;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-onboarding'] });
    queryClient.invalidateQueries({ queryKey: ['team-onboarding'] });
    queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] });
  };

  if (mine.isLoading || team.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  const err = mine.error ?? team.error;
  if (err) return <p className='text-sm text-red-600'>{apiErrorMessage(err)}</p>;

  return (
    <div className='w-full space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Onboarding</h1>
      {hasTeam && (
        <div className='flex gap-2'>
          <button type='button' onClick={() => setTab('mine')} className={tabBtn(view === 'mine')}>
            Me
          </button>
          <button type='button' onClick={() => setTab('team')} className={tabBtn(view === 'team')}>
            My team ({team.data!.length})
          </button>
        </div>
      )}
      {view === 'mine' ? (
        <>
          <MyProbation />
          <Mine data={mine.data ?? null} onChanged={refresh} />
        </>
      ) : (
        <MyTeam team={team.data ?? []} onChanged={refresh} />
      )}
    </div>
  );
};

export default MyOnboardingPage;

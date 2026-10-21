import { Link } from 'react-router-dom';

import type { OnboardingJourney, OnboardingTask, OnboardingPhase } from '@app-types/api.types';
import { POLICIES_ROUTE } from '@constants/Common/navigation/routes.constants';

const PHASES: Array<{ key: OnboardingPhase; title: string; offset: string }> = [
  { key: 'before_start', title: 'Before you start', offset: 'joining −7 days' },
  { key: 'week_one', title: 'Week one', offset: 'joining day' },
  { key: 'first_30', title: 'First 30 days', offset: 'joining +30 days' },
];

const OWNER_LABEL: Record<OnboardingTask['owner'], string> = {
  employee: 'you',
  hr: 'HR',
  manager: 'your manager',
  admin: 'admin',
  ops: 'OPS',
  payroll: 'payroll',
};

/**
 * The three-phase checklist, shared by the employee page (ticks own tasks)
 * and the HR drill-in (ticks any non-policy task). A policy-linked step is
 * never a checkbox — it completes through the policy acknowledgement.
 */
const OnboardingChecklist = ({
  journey,
  ownerLabels = true,
  canTick,
  onToggle,
  ticking,
}: {
  journey: OnboardingJourney;
  /** "waiting on you/HR/manager" labels make sense on the employee view. */
  ownerLabels?: boolean;
  canTick: (task: OnboardingTask) => boolean;
  onToggle: (task: OnboardingTask) => void;
  ticking: boolean;
}) => (
  <div className='space-y-4'>
    {PHASES.map((phase) => {
      const tasks = journey.tasks.filter((t) => t.phase === phase.key);
      if (tasks.length === 0) return null;
      const done = tasks.filter((t) => t.done).length;
      return (
        <div key={phase.key} className='rounded-xl border border-slate-200 bg-white p-5'>
          <div className='flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-slate-700'>
              {phase.title}{' '}
              <span className='ml-1 text-xs font-normal text-slate-400'>({phase.offset})</span>
            </h2>
            <span className='text-xs text-slate-400'>
              {done}/{tasks.length}
            </span>
          </div>
          <div className='mt-3 divide-y divide-slate-100'>
            {tasks.map((t) => (
              <div key={t.id} className='flex items-center justify-between gap-3 py-2.5'>
                <div className='flex min-w-0 items-center gap-3'>
                  {t.policyCode ? (
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                        t.done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                      }`}
                      title='Completes when the policy is acknowledged'
                    >
                      §
                    </span>
                  ) : (
                    <input
                      type='checkbox'
                      checked={t.done}
                      disabled={!canTick(t) || ticking}
                      onChange={() => onToggle(t)}
                      className='h-4 w-4 shrink-0 disabled:opacity-40'
                    />
                  )}
                  <div className='min-w-0'>
                    <p className={`text-sm ${t.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {t.title}
                    </p>
                    <p className='text-xs text-slate-400'>
                      {t.done
                        ? t.doneByName
                          ? `done by ${t.doneByName}${t.doneAt ? ` · ${t.doneAt.slice(0, 10)}` : ''}`
                          : t.doneAt
                            ? `acknowledged ${t.doneAt.slice(0, 10)}`
                            : 'done'
                        : t.policyCode
                          ? 'completed by acknowledging the policy'
                          : ownerLabels
                            ? `waiting on ${OWNER_LABEL[t.owner]}`
                            : `waits on ${t.owner}`}
                    </p>
                  </div>
                </div>
                {t.policyCode && !t.done && (
                  <Link
                    to={POLICIES_ROUTE}
                    className='shrink-0 text-xs text-brand-600 hover:underline'
                  >
                    Read &amp; acknowledge →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export default OnboardingChecklist;

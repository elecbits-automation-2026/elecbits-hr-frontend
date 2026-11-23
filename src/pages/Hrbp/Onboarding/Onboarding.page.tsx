import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OnboardingQueueRow } from '@app-types/api.types';
import OnboardingChecklist from '@components/Common/Onboarding/OnboardingChecklist.component';
import { addDays, fmtDay, phaseTitle } from '@constants/Common/onboarding.constants';
import { employeesApi } from '@services/api/employees.api';
import { onboardingApi } from '@services/api/onboarding.api';
import { apiErrorMessage } from '@utils/apiError';
import ModalShell from '@components/Common/Utilities/ModalShell.component';

/** HR drill-in: the full checklist; HR acts on the HR steps only (owners tick their own). */
const JourneyModal = ({ row, onClose }: { row: OnboardingQueueRow; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const journey = useQuery({
    queryKey: ['hr-onboarding-journey', row.employee.id],
    queryFn: () => onboardingApi.forEmployee(row.employee.id),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-onboarding-journey', row.employee.id] });
    queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] });
    queryClient.invalidateQueries({ queryKey: ['my-onboarding'] });
  };

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4'>
      <div className='my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>
            {row.employee.name}
            <span className='ml-2 text-sm font-normal text-slate-500'>
              {row.employee.employeeCode}
            </span>
          </h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
          >
            Close
          </button>
        </div>
        <p className='mt-1 text-xs text-slate-500'>
          Started {row.startedOn} · due {row.dueOn}. Each step is done by its owner: you tick the HR
          steps (with a note of what was done) and upload the signed offer letter; the joiner
          uploads their documents and acknowledges the Code of Conduct; their manager ticks the
          manager steps (you do, if they have no manager of their own); OPS and payroll do theirs.
          You can open every uploaded document with View.
        </p>
        <div className='mt-4'>
          {journey.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
          {journey.error && (
            <p className='text-sm text-red-600'>{apiErrorMessage(journey.error)}</p>
          )}
          {journey.data && <OnboardingChecklist journey={journey.data} onChanged={refresh} />}
        </div>
      </div>
    </div>
  );
};

/** Start a journey by hand — rehires or joiners older than the auto window. */
const StartModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [startedOn, setStartedOn] = useState('');

  const employees = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  // The date the journey will run from: the picked date, else their joining date.
  const startFrom =
    startedOn || (employees.data ?? []).find((e) => e.id === employeeId)?.dateOfJoining || '';
  const start = useMutation({
    mutationFn: () => onboardingApi.start({ employeeId, ...(startedOn ? { startedOn } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding-overview'] });
      onClose();
    },
  });

  return (
    <ModalShell onClose={onClose}>
      <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>Start an onboarding journey</h2>
        <p className='mt-1 text-xs text-slate-500'>
          Recent joiners get one automatically on their first visit — this is for everyone else.
        </p>
        <label className='mt-4 block text-sm'>
          <span className='text-slate-600'>Person</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value=''>Choose…</option>
            {(employees.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.employeeCode})
              </option>
            ))}
          </select>
        </label>
        <label className='mt-3 block text-sm'>
          <span className='text-slate-600'>Start date (defaults to their joining date)</span>
          <input
            type='date'
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
        </label>
        {startFrom && (
          <p className='mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600'>
            Before-you-start steps are dated {fmtDay(addDays(startFrom, -7))}; the 30-day check-in
            lands on{' '}
            <span className='font-medium text-slate-800'>{fmtDay(addDays(startFrom, 30))}</span>.
          </p>
        )}
        {employeeId && !startFrom && (
          <p className='mt-3 text-xs text-amber-700'>
            No joining date on file — pick a start date to see the phase dates.
          </p>
        )}
        {start.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(start.error)}</p>}
        <div className='mt-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={!employeeId || start.isPending}
            onClick={() => start.mutate()}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {start.isPending ? 'Starting…' : 'Start journey'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const daysChip = (row: OnboardingQueueRow) => {
  if (row.status === 'done')
    return (
      <span className='rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700'>done</span>
    );
  if (row.daysLeft < 0)
    return (
      <span className='rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700'>
        {-row.daysLeft}d overdue
      </span>
    );
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        row.daysLeft <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {row.daysLeft}d left
    </span>
  );
};

/** Where the journey is: the phase of its next open step, or not started / complete. */
const phaseChip = (row: OnboardingQueueRow) => {
  if (row.status === 'done' || row.currentPhase === null)
    return (
      <span className='rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700'>
        ✓ Complete
      </span>
    );
  if (row.progress.done === 0)
    return (
      <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'>
        Not started
      </span>
    );
  return (
    <span className='rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600'>
      {phaseTitle(row.currentPhase)}
    </span>
  );
};

/** Nudge one open journey — once a day; the button says so afterwards. */
const NudgeButton = ({ row }: { row: OnboardingQueueRow }) => {
  const queryClient = useQueryClient();
  const nudge = useMutation({
    mutationFn: () => onboardingApi.nudge(row.employee.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] }),
  });
  if (row.status === 'done') return null;
  if (row.nudgedToday || nudge.isSuccess)
    return <span className='text-xs text-slate-500'>Nudged today</span>;
  return (
    <button
      type='button'
      disabled={nudge.isPending}
      onClick={() => nudge.mutate()}
      title={
        nudge.error
          ? apiErrorMessage(nudge.error)
          : 'Bell + email to whoever owns an open step (joiner, manager, OPS, payroll)'
      }
      className={`text-xs hover:underline disabled:opacity-50 ${nudge.error ? 'text-red-600' : 'text-brand-600'}`}
    >
      {nudge.isPending ? 'Nudging…' : nudge.error ? 'Nudge failed' : 'Nudge'}
    </button>
  );
};

/** Start a listed joiner's journey from their joining date, in one click. */
const StartNowButton = ({ employeeId }: { employeeId: string }) => {
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: () => onboardingApi.start({ employeeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding-overview'] });
    },
  });
  return (
    <button
      type='button'
      disabled={start.isPending}
      onClick={() => start.mutate()}
      title={start.error ? apiErrorMessage(start.error) : undefined}
      className={`text-xs hover:underline disabled:opacity-50 ${start.error ? 'text-red-600' : 'text-brand-600'}`}
    >
      {start.isPending ? 'Starting…' : start.error ? 'Could not start' : 'Start journey'}
    </button>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
  <div className='rounded-xl border border-slate-200 bg-white px-4 py-3'>
    <div className={`text-2xl font-semibold tabular-nums ${tone ?? 'text-slate-800'}`}>{value}</div>
    <div className='text-xs text-slate-500'>{label}</div>
  </div>
);

/** Who is onboarding — the HR queue behind hrbp.people. */
const HrOnboardingPage = () => {
  const [open, setOpen] = useState<OnboardingQueueRow | null>(null);
  const [starting, setStarting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-onboarding'],
    queryFn: onboardingApi.queue,
  });
  const overview = useQuery({
    queryKey: ['hr-onboarding-overview'],
    queryFn: onboardingApi.overview,
  });
  const stats = overview.data?.stats;
  const noJourney = overview.data?.noJourney ?? [];

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Onboarding</h1>
        <button
          type='button'
          onClick={() => setStarting(true)}
          className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500'
        >
          + Start a journey
        </button>
      </div>

      {stats && (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <Stat label='Joined in the last 90 days' value={stats.joinedLast90Days} />
          <Stat label='Onboarding in progress' value={stats.inProgress} />
          <Stat
            label='Past day 30, not finished'
            value={stats.pastDay30}
            tone={stats.pastDay30 > 0 ? 'text-red-700' : undefined}
          />
          <Stat label='Finished' value={stats.done} />
        </div>
      )}

      {noJourney.length > 0 && (
        <div className='rounded-xl border border-amber-200 bg-amber-50/60 p-5'>
          <h2 className='text-sm font-semibold text-amber-800'>
            {noJourney.length} {noJourney.length === 1 ? 'joiner has' : 'joiners have'} no journey
          </h2>
          <p className='text-xs text-amber-700'>
            Joined in the last 90 days or joining soon, but no onboarding started.
          </p>
          <div className='overflow-x-auto'>
            <table className='mt-2 min-w-full text-sm'>
              <tbody>
                {noJourney.map((p) => (
                  <tr key={p.employee.id} className='border-t border-amber-100'>
                    <td className='py-2 pr-4'>
                      <span className='font-medium text-slate-700'>{p.employee.name}</span>
                      <span className='ml-2 text-xs text-slate-500'>{p.employee.employeeCode}</span>
                      {p.status === 'invited' && (
                        <span className='ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700'>
                          invited
                        </span>
                      )}
                    </td>
                    <td className='py-2 pr-4 text-slate-600'>joins {p.dateOfJoining}</td>
                    <td className='py-2 text-right'>
                      <StartNowButton employeeId={p.employee.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {error && <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>}
        {data && data.length === 0 && (
          <p className='text-sm text-slate-500'>
            Nobody is onboarding right now — a journey appears when a joiner from the last 90 days
            first opens their Onboarding page, or when you start one here.
          </p>
        )}
        {data && data.length > 0 && (
          <div className='overflow-x-auto'>
            <table className='min-w-full text-sm'>
              <thead>
                <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                  <th className='py-2 pr-4'>Person</th>
                  <th className='py-2 pr-4'>Started</th>
                  <th className='py-2 pr-4'>Phase</th>
                  <th className='py-2 pr-4'>Progress</th>
                  <th className='py-2 pr-4'>Due</th>
                  <th className='py-2'></th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className='border-t border-slate-100'>
                    <td className='py-2.5 pr-4'>
                      <span className='font-medium text-slate-700'>{r.employee.name}</span>
                      <span className='ml-2 text-xs text-slate-500'>{r.employee.employeeCode}</span>
                    </td>
                    <td className='py-2.5 pr-4 text-slate-600'>{r.startedOn}</td>
                    <td className='py-2.5 pr-4 whitespace-nowrap'>{phaseChip(r)}</td>
                    <td className='py-2.5 pr-4'>
                      <div className='flex items-center gap-2'>
                        <div className='h-1.5 w-24 overflow-hidden rounded-full bg-slate-100'>
                          <div
                            className='h-full rounded-full bg-brand-600'
                            style={{
                              width: `${r.progress.total > 0 ? (r.progress.done / r.progress.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className='text-xs text-slate-500'>
                          {r.progress.done}/{r.progress.total}
                        </span>
                      </div>
                    </td>
                    <td className='py-2.5 pr-4'>{daysChip(r)}</td>
                    <td className='py-2.5 text-right'>
                      <span className='inline-flex items-center gap-3'>
                        <NudgeButton row={r} />
                        <button
                          type='button'
                          onClick={() => setOpen(r)}
                          className='text-xs text-brand-600 hover:underline'
                        >
                          Open
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && <JourneyModal row={open} onClose={() => setOpen(null)} />}
      {starting && <StartModal onClose={() => setStarting(false)} />}
    </div>
  );
};

export default HrOnboardingPage;

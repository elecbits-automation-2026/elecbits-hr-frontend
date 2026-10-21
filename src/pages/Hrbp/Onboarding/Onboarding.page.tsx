import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OnboardingQueueRow, OnboardingTask } from '@app-types/api.types';
import OnboardingChecklist from '@components/Common/Onboarding/OnboardingChecklist.component';
import { employeesApi } from '@services/api/employees.api';
import { onboardingApi } from '@services/api/onboarding.api';
import { apiErrorMessage } from '@utils/apiError';

/** HR drill-in: the full checklist; HR may tick any non-policy step. */
const JourneyModal = ({ row, onClose }: { row: OnboardingQueueRow; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const journey = useQuery({
    queryKey: ['hr-onboarding-journey', row.employee.id],
    queryFn: () => onboardingApi.forEmployee(row.employee.id),
  });
  const toggle = useMutation({
    mutationFn: (task: OnboardingTask) => onboardingApi.toggleTask(task.id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding-journey', row.employee.id] });
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['my-onboarding'] });
    },
  });

  return (
    <div className='fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4'>
      <div className='my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>
            {row.employee.name}
            <span className='ml-2 text-sm font-normal text-slate-400'>{row.employee.employeeCode}</span>
          </h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
          >
            Close
          </button>
        </div>
        <p className='mt-1 text-xs text-slate-400'>
          Started {row.startedOn} · due {row.dueOn}. You can tick any step except the
          policy-linked ones — those need the person's own acknowledgement.
        </p>
        <div className='mt-4'>
          {journey.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
          {journey.error && <p className='text-sm text-red-600'>{apiErrorMessage(journey.error)}</p>}
          {toggle.error && <p className='text-sm text-red-600'>{apiErrorMessage(toggle.error)}</p>}
          {journey.data && (
            <OnboardingChecklist
              journey={journey.data}
              ownerLabels={false}
              canTick={(t) => !t.policyCode}
              onToggle={(t) => toggle.mutate(t)}
              ticking={toggle.isPending}
            />
          )}
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
  const start = useMutation({
    mutationFn: () =>
      onboardingApi.start({ employeeId, ...(startedOn ? { startedOn } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-onboarding'] });
      onClose();
    },
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>Start an onboarding journey</h2>
        <p className='mt-1 text-xs text-slate-400'>
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
    </div>
  );
};

const daysChip = (row: OnboardingQueueRow) => {
  if (row.status === 'done')
    return <span className='rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700'>done</span>;
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

/** Who is onboarding — the HR queue behind hrbp.people. */
const HrOnboardingPage = () => {
  const [open, setOpen] = useState<OnboardingQueueRow | null>(null);
  const [starting, setStarting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-onboarding'],
    queryFn: onboardingApi.queue,
  });

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
          <table className='min-w-full text-sm'>
            <thead>
              <tr className='text-left text-xs uppercase tracking-wide text-slate-400'>
                <th className='py-2 pr-4'>Person</th>
                <th className='py-2 pr-4'>Started</th>
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
                    <span className='ml-2 text-xs text-slate-400'>{r.employee.employeeCode}</span>
                  </td>
                  <td className='py-2.5 pr-4 text-slate-600'>{r.startedOn}</td>
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
                    <button
                      type='button'
                      onClick={() => setOpen(r)}
                      className='text-xs text-brand-600 hover:underline'
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && <JourneyModal row={open} onClose={() => setOpen(null)} />}
      {starting && <StartModal onClose={() => setStarting(false)} />}
    </div>
  );
};

export default HrOnboardingPage;

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { jobsApi } from '@services/api/jobs.api';
import { apiErrorMessage } from '@utils/apiError';

const STATUS_LOOK = {
  running: 'bg-blue-50 text-blue-700',
  succeeded: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
} as const;

/** "reminded 6 · leave 2 · nomination 1" from a run's summary. */
const summaryText = (summary: Record<string, unknown> | null): string =>
  summary
    ? Object.entries(summary)
        .map(([k, v]) => `${k} ${String(v)}`)
        .join(' · ')
    : '—';

/**
 * Background jobs (Admin): whether the scheduler is on, what each job does
 * and when, the latest runs, and a Run now button.
 */
const BackgroundJobs = () => {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ['admin-jobs'], queryFn: jobsApi.overview });
  const run = useMutation({
    mutationFn: jobsApi.runNow,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-jobs'] }),
  });

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='text-sm font-semibold text-slate-700'>Background jobs</h2>
        {overview.data && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              overview.data.schedulerEnabled
                ? 'bg-green-50 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            scheduler {overview.data.schedulerEnabled ? 'on' : 'off on this server'}
          </span>
        )}
      </div>
      {overview.error && (
        <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(overview.error)}</p>
      )}
      {run.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(run.error)}</p>}
      <ul className='mt-3 space-y-2'>
        {(overview.data?.jobs ?? []).map((j) => (
          <li
            key={j.name}
            className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2'
          >
            <span className='text-sm'>
              <span className='font-medium text-slate-800'>{j.name}</span>
              <span className='ml-2 text-xs text-slate-500'>
                {j.description} {j.schedule}.
              </span>
            </span>
            <button
              type='button'
              disabled={run.isPending}
              onClick={() => run.mutate(j.name)}
              className='rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50'
            >
              {run.isPending && run.variables === j.name ? 'Running…' : 'Run now'}
            </button>
          </li>
        ))}
      </ul>
      {(overview.data?.runs.length ?? 0) > 0 && (
        <table className='mt-4 w-full text-left text-xs'>
          <thead>
            <tr className='text-slate-400'>
              <th className='py-1 pr-3 font-medium'>Started</th>
              <th className='py-1 pr-3 font-medium'>Job</th>
              <th className='py-1 pr-3 font-medium'>Run</th>
              <th className='py-1 pr-3 font-medium'>Status</th>
              <th className='py-1 font-medium'>Result</th>
            </tr>
          </thead>
          <tbody>
            {overview.data!.runs.slice(0, 10).map((r) => (
              <tr key={r.id} className='border-t border-slate-100 align-top'>
                <td className='py-1.5 pr-3 tabular-nums text-slate-500'>
                  {new Date(r.startedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </td>
                <td className='py-1.5 pr-3 text-slate-700'>{r.job}</td>
                <td className='py-1.5 pr-3 text-slate-500'>
                  {r.runKey.startsWith('manual-') ? 'by hand' : 'scheduled'}
                  {r.attempts > 1 ? ` · try ${r.attempts}` : ''}
                </td>
                <td className='py-1.5 pr-3'>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_LOOK[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className='py-1.5 text-slate-600'>
                  {r.status === 'failed' ? r.error : summaryText(r.summary)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BackgroundJobs;

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BAND_LOOK } from '@constants/Common/quarter.constants';
import { quarterReportsApi } from '@services/api/quarterReports.api';
import { apiErrorMessage } from '@utils/apiError';

import QuarterReportCard from './QuarterReportCard.component';

/**
 * Pick a quarter, see the team overview and each person's frozen report.
 * HR (`canClose`) also closes quarters. `scope='hr'` (default) shows the
 * people the viewer manages plus their HR reach; `scope='rm'` (the personal
 * My performance board) only the people they manage — the server filters.
 */
const QuarterBoard = ({
  canClose = false,
  scope = 'hr',
}: {
  canClose?: boolean;
  scope?: 'rm' | 'hr';
}) => {
  const queryClient = useQueryClient();
  const cycles = useQuery({ queryKey: ['quarter-cycles'], queryFn: quarterReportsApi.cycles });
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmEarly, setConfirmEarly] = useState(false);
  const name =
    picked ?? cycles.data?.find((c) => c.closedAt)?.name ?? cycles.data?.[0]?.name ?? null;
  const cycle = cycles.data?.find((c) => c.name === name) ?? null;

  const view = useQuery({
    queryKey: ['quarter-view', name, scope],
    queryFn: () => quarterReportsApi.view(name!, scope === 'rm' ? { as: 'rm' } : undefined),
    enabled: name !== null && cycle?.closedAt !== null,
  });
  const close = useMutation({
    mutationFn: () => quarterReportsApi.close(name!, cycle?.current === true),
    onSuccess: () => {
      setConfirmEarly(false);
      queryClient.invalidateQueries({ queryKey: ['quarter-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['quarter-view'] });
      queryClient.invalidateQueries({ queryKey: ['my-goals'] });
    },
  });

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2'>
        {(cycles.data ?? []).map((c) => (
          <button
            key={c.name}
            type='button'
            onClick={() => {
              setPicked(c.name);
              setConfirmEarly(false);
            }}
            className={`rounded-full px-3 py-1 text-xs ${
              c.name === name
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {c.name}
            {c.closedAt ? ' · closed' : c.current ? ' · running' : ''}
          </button>
        ))}
      </div>

      {cycle && !cycle.closedAt && (
        <div className='rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600'>
          <p>
            {cycle.name} ({cycle.startDate} → {cycle.endDate}) is still open — goals can still
            change and no reports exist yet.
          </p>
          {canClose && (
            <div className='mt-3'>
              {close.error && (
                <p className='mb-2 text-sm text-red-600'>{apiErrorMessage(close.error)}</p>
              )}
              {cycle.current && !confirmEarly ? (
                <button
                  type='button'
                  onClick={() => setConfirmEarly(true)}
                  className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
                >
                  Close {cycle.name} early…
                </button>
              ) : (
                <span className='flex flex-wrap items-center gap-2'>
                  {cycle.current && (
                    <span className='text-xs text-amber-700'>
                      It runs until {cycle.endDate}. Closing now freezes every goal and writes the
                      reports from today&rsquo;s record. This cannot be undone.
                    </span>
                  )}
                  <button
                    type='button'
                    disabled={close.isPending}
                    onClick={() => close.mutate()}
                    className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
                  >
                    {close.isPending ? 'Closing…' : `Close ${cycle.name} and write the reports`}
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {view.error && <p className='text-sm text-red-600'>{apiErrorMessage(view.error)}</p>}
      {view.data && (
        <>
          <p className='text-xs text-slate-400'>
            Closed {view.data.cycle.closedAt!.slice(0, 10)}
            {view.data.cycle.closedByName ? ` by ${view.data.cycle.closedByName}` : ''} ·{' '}
            {view.data.reports.length} report{view.data.reports.length === 1 ? '' : 's'} you can
            see.
          </p>
          {view.data.teams.length > 0 && (
            <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white p-4'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-xs text-slate-400'>
                    <th className='py-1 pr-3 font-medium'>Team (manager at close)</th>
                    <th className='py-1 pr-3 text-right font-medium'>People</th>
                    <th className='py-1 pr-3 text-right font-medium'>Avg score</th>
                    {(Object.keys(BAND_LOOK) as Array<keyof typeof BAND_LOOK>).map((b) => (
                      <th key={b} className='py-1 pr-3 text-right font-medium'>
                        {b === 'below' ? '<50' : b}
                      </th>
                    ))}
                    <th className='py-1 text-right font-medium'>Unscored</th>
                  </tr>
                </thead>
                <tbody>
                  {view.data.teams.map((t) => (
                    <tr key={t.rm?.id ?? 'none'} className='border-t border-slate-100'>
                      <td className='py-1.5 pr-3 text-slate-700'>{t.rm?.name ?? 'No manager'}</td>
                      <td className='py-1.5 pr-3 text-right tabular-nums'>{t.people}</td>
                      <td className='py-1.5 pr-3 text-right tabular-nums'>
                        {t.averageScore ?? '—'}
                      </td>
                      <td className='py-1.5 pr-3 text-right tabular-nums'>{t.bands.E3}</td>
                      <td className='py-1.5 pr-3 text-right tabular-nums'>{t.bands.E2}</td>
                      <td className='py-1.5 pr-3 text-right tabular-nums'>{t.bands.E1}</td>
                      <td className='py-1.5 pr-3 text-right tabular-nums text-red-600'>
                        {t.bands.below}
                      </td>
                      <td className='py-1.5 text-right tabular-nums text-slate-400'>
                        {t.bands.unscored}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ul className='space-y-2'>
            {view.data.reports.map((r) => (
              <QuarterReportCard key={r.id} report={r} canAdjust showPerson />
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default QuarterBoard;

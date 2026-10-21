import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { GoalCategory, QuarterReport } from '@app-types/api.types';
import { BAND_LOOK, GOAL_CATEGORY_LABELS } from '@constants/Common/quarter.constants';
import { quarterReportsApi } from '@services/api/quarterReports.api';
import { apiErrorMessage } from '@utils/apiError';

const Stat = ({ n, label, tone }: { n: string; label: string; tone?: string }) => (
  <div>
    <p className={`text-lg font-semibold tabular-nums ${tone ?? 'text-slate-800'}`}>{n}</p>
    <p className='text-xs text-slate-500'>{label}</p>
  </div>
);

/**
 * One frozen quarter report. With `canAdjust` the manager (or HR) can set
 * the final score with a reason; the computed score always stays visible.
 */
const QuarterReportCard = ({
  report,
  canAdjust = false,
  showPerson = false,
}: {
  report: QuarterReport;
  canAdjust?: boolean;
  showPerson?: boolean;
}) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(!showPerson);
  const [adjusting, setAdjusting] = useState(false);
  const [score, setScore] = useState(String(report.finalScore ?? report.computedScore ?? ''));
  const [reason, setReason] = useState('');
  const adjust = useMutation({
    mutationFn: () => quarterReportsApi.adjust(report.id, Number(score), reason.trim()),
    onSuccess: () => {
      setAdjusting(false);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['quarter-view'] });
      queryClient.invalidateQueries({ queryKey: ['my-quarter-reports'] });
    },
  });
  const band = report.finalBand ? BAND_LOOK[report.finalBand] : null;
  const adjusted = report.adjustedAt !== null;
  const validScore = score !== '' && Number(score) >= 0 && Number(score) <= 100;

  return (
    <li className='rounded-lg border border-slate-200 bg-white'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left'
      >
        <span className='font-medium text-slate-800'>
          {showPerson ? report.employee.name : report.cycleName}
          {showPerson && report.departmentName && (
            <span className='ml-2 text-xs font-normal text-slate-400'>{report.departmentName}</span>
          )}
        </span>
        <span className='flex items-center gap-2'>
          {report.pipCandidate && (
            <span className='rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700'>
              PIP candidate
            </span>
          )}
          {band ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${band.cls}`}>
              {band.label}
            </span>
          ) : (
            <span className='text-xs text-slate-400'>no goals — unscored</span>
          )}
          <span className='text-lg font-semibold tabular-nums text-slate-800'>
            {report.finalScore ?? '—'}
          </span>
          <span className='text-xs text-slate-400'>{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open && (
        <div className='space-y-4 border-t border-slate-100 px-4 py-3'>
          <div className='flex flex-wrap gap-6'>
            {(Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[]).map((c) => (
              <Stat
                key={c}
                n={report.byCategory[c] === null ? '—' : `${report.byCategory[c]}%`}
                label={`${GOAL_CATEGORY_LABELS[c].label} (${GOAL_CATEGORY_LABELS[c].share}%)`}
              />
            ))}
            <Stat
              n={report.computedScore === null ? '—' : String(report.computedScore)}
              label='computed score'
            />
          </div>
          {adjusted && (
            <p className='rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600'>
              Final score set to <b>{report.finalScore}</b> by {report.adjustedByName} on{' '}
              {report.adjustedAt!.slice(0, 10)} (computed {report.computedScore ?? '—'}):{' '}
              {report.adjustReason}
            </p>
          )}

          {report.goals.length > 0 && (
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-xs text-slate-400'>
                  <th className='py-1 pr-3 font-medium'>Goal</th>
                  <th className='py-1 pr-3 font-medium'>Category</th>
                  <th className='py-1 pr-3 text-right font-medium'>Weight</th>
                  <th className='py-1 text-right font-medium'>Progress</th>
                </tr>
              </thead>
              <tbody>
                {report.goals.map((g, i) => (
                  <tr key={i} className='border-t border-slate-100'>
                    <td className='py-1.5 pr-3 text-slate-700'>{g.title}</td>
                    <td className='py-1.5 pr-3 text-xs text-slate-500'>
                      {GOAL_CATEGORY_LABELS[g.category].label}
                    </td>
                    <td className='py-1.5 pr-3 text-right tabular-nums text-slate-500'>
                      {g.weight}
                    </td>
                    <td className='py-1.5 text-right tabular-nums'>{g.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className='flex flex-wrap gap-6 text-sm'>
            <Stat
              n={`${report.updates.submitted}/${report.updates.expected}`}
              label='work updates / working days'
            />
            <Stat
              n={String(report.updates.monthsOverAllowance)}
              label='months over the miss allowance'
              tone={report.updates.monthsOverAllowance > 0 ? 'text-red-600' : undefined}
            />
            <Stat
              n={
                report.attendance.attendancePct === null
                  ? '—'
                  : `${report.attendance.attendancePct}%`
              }
              label={`attendance (${report.attendance.absent} absent, ${report.attendance.leave} leave)`}
            />
            <Stat n={String(report.attendance.lateIns)} label='late check-ins' />
            <Stat n={String(report.recognitions)} label='awards' />
            <Stat
              n={`${report.feedback.appreciation} / ${report.feedback.concern}`}
              label='appreciation / concern notes'
            />
            <Stat
              n={String(report.atRiskGoals)}
              label='goals at risk at close'
              tone={report.atRiskGoals > 0 ? 'text-amber-600' : undefined}
            />
          </div>
          <p className='text-xs text-slate-400'>
            {report.rm ? `Manager at close: ${report.rm.name}. ` : ''}
            {report.appraisalEligible
              ? 'Eligible for appraisal consideration (six months of service).'
              : 'Not yet eligible for appraisal — under six months of service by the quarter end.'}
          </p>

          {canAdjust && !adjusting && (
            <button
              type='button'
              onClick={() => setAdjusting(true)}
              className='text-xs font-medium text-brand-600 hover:underline'
            >
              {adjusted ? 'Change the final score' : 'Set the final score'}
            </button>
          )}
          {canAdjust && adjusting && (
            <div className='space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3'>
              <div className='flex flex-wrap items-end gap-2'>
                <label className='text-xs text-slate-500'>
                  Final score (0–100)
                  <input
                    type='number'
                    min={0}
                    max={100}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className='mt-1 block w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm'
                  />
                </label>
                <label className='min-w-[16rem] flex-1 text-xs text-slate-500'>
                  Reason (they see it)
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                    className='mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm'
                  />
                </label>
              </div>
              {adjust.error && (
                <p className='text-xs text-red-600'>{apiErrorMessage(adjust.error)}</p>
              )}
              <div className='flex gap-2'>
                <button
                  type='button'
                  disabled={!validScore || reason.trim().length < 10 || adjust.isPending}
                  onClick={() => adjust.mutate()}
                  className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40'
                >
                  Save final score
                </button>
                <button
                  type='button'
                  onClick={() => setAdjusting(false)}
                  className='text-xs text-slate-400 hover:text-slate-600'
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

export default QuarterReportCard;

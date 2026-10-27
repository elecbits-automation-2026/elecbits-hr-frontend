import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { HiringReportRow, TrackerRow, TrackerView } from '@app-types/api.types';
import { ROUND_LABEL, SOURCE_LABEL, STAGE_LABEL, longDate, rupees } from '@constants/Common/hiring.constants';
import { hiringApi } from '@services/api/hiring.api';
import { apiErrorMessage } from '@utils/apiError';
import { csvCell, downloadText } from '@utils/csv';

const card = 'rounded-xl border border-slate-200 bg-white';
const btn =
  'rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50';
const th = 'whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400';
const td = 'whitespace-nowrap px-2 py-1.5 text-sm';

const iso = (d: Date) => d.toLocaleDateString('en-CA');
const monthStart = () => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
};

const toCsv = (head: string[], rows: Array<Array<string | number | null>>) =>
  [head, ...rows].map((r) => r.map((v) => csvCell(v === null ? '' : String(v))).join(',')).join('\n');

/** The report's numeric columns, in the deck's order. */
const COLS: Array<{ key: keyof HiringReportRow; label: string }> = [
  { key: 'sourced', label: 'Sourced' },
  { key: 'callAttempts', label: 'Calls' },
  { key: 'callUnique', label: 'People called' },
  { key: 'screened', label: 'Screened' },
  { key: 'aligned', label: 'Interviews aligned' },
  { key: 'held', label: 'Held' },
  { key: 'offersShared', label: 'Offers' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'joined', label: 'Joined' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
  { key: 'overdue', label: 'Overdue actions' },
];

/** Role × SPOC activity and outcomes over a period (workflow deck slides 14–16). */
const ActivityReport = () => {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(iso(new Date()));
  const report = useQuery({
    queryKey: ['hiring-report', from, to],
    queryFn: () => hiringApi.report(from, to),
    enabled: !!from && !!to && from <= to,
  });
  const rows = report.data?.rows ?? [];
  const total = (k: keyof HiringReportRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const exportCsv = () =>
    downloadText(
      `hiring-report-${from}-to-${to}.csv`,
      toCsv(
        ['Request', 'Role', 'Position', 'Department', 'TA SPOC', ...COLS.map((c) => c.label)],
        rows.map((r) => [
          r.requestCode,
          r.roleTitle,
          r.positionNumber,
          r.departmentName,
          r.spocName,
          ...COLS.map((c) => r[c.key] as number),
        ]),
      ),
    );

  return (
    <section className={`${card} space-y-3 p-4`}>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='text-base font-semibold text-slate-800'>Activity by role and SPOC</h2>
          <p className='text-xs text-slate-500'>
            Calls are activities; interviews count each round. Offered, accepted and joined are
            counted apart.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <input type='date' value={from} onChange={(e) => setFrom(e.target.value)} className='rounded-md border border-slate-300 px-2 py-1' aria-label='From' />
          <span className='text-slate-400'>to</span>
          <input type='date' value={to} onChange={(e) => setTo(e.target.value)} className='rounded-md border border-slate-300 px-2 py-1' aria-label='To' />
          <button type='button' disabled={!rows.length} onClick={exportCsv} className={btn}>
            Export CSV
          </button>
        </div>
      </div>
      {report.error && <p className='text-sm text-red-600'>{apiErrorMessage(report.error)}</p>}
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[900px]'>
          <thead className='border-b border-slate-200'>
            <tr>
              <th className={th}>Role / TA SPOC</th>
              {COLS.map((c) => (
                <th key={c.key} className={`${th} text-right`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.positionId} className='border-b border-slate-100'>
                <td className={td}>
                  <span className='font-medium text-slate-800'>
                    {r.roleTitle} #{r.positionNumber}
                  </span>
                  <span className='block text-xs text-slate-400'>
                    {r.departmentName} · {r.spocName ?? 'no recruiter yet'}
                  </span>
                </td>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`${td} text-right font-mono ${c.key === 'overdue' && r.overdue > 0 ? 'font-semibold text-red-600' : 'text-slate-700'}`}
                  >
                    {r[c.key] as number}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className='font-semibold'>
                <td className={td}>Total</td>
                {COLS.map((c) => (
                  <td key={c.key} className={`${td} text-right font-mono text-slate-800`}>
                    {total(c.key)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
        {report.isSuccess && rows.length === 0 && (
          <p className='py-6 text-center text-sm text-slate-400'>No positions on approved lines.</p>
        )}
      </div>
    </section>
  );
};

/** Every open next action by owner and due date; overdue first (workflow deck slide 15). */
const PendingActions = () => {
  const list = useQuery({ queryKey: ['pending-actions'], queryFn: hiringApi.pendingActions });
  return (
    <section className={`${card} space-y-2 p-4`}>
      <h2 className='text-base font-semibold text-slate-800'>Pending and overdue actions</h2>
      {list.data?.length === 0 && <p className='text-sm text-slate-400'>Nothing pending.</p>}
      <ul className='divide-y divide-slate-100'>
        {list.data?.map((x) => (
          <li key={x.applicationId} className='flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm'>
            <span>
              <span className='font-medium text-slate-800'>{x.nextAction}</span>
              <span className='text-xs text-slate-500'>
                {' '}
                · {x.candidateName} ({x.candidateCode}) · {x.roleTitle} #{x.positionNumber}
              </span>
            </span>
            <span className={`text-xs ${x.overdue ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
              {x.ownerName ?? 'no owner'}
              {x.due && <> · due {longDate(x.due)}</>}
              {x.overdue && ' · overdue'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * The hiring tracker as a table. The INTERNAL view (TA / HR) has contacts and
 * CTC; the EXTERNAL view (dept heads / leadership) leaves them out.
 */
export const TrackerTable = ({ view, title }: { view: TrackerView; title: string }) => {
  const list = useQuery({ queryKey: ['hiring-tracker', view], queryFn: () => hiringApi.tracker(view) });
  const rows: TrackerRow[] = list.data ?? [];
  const internal = view === 'internal';
  const head = [
    'Request',
    'Candidate ID',
    'Candidate',
    'Role',
    'Department',
    'TA SPOC',
    'Source',
    'Stage',
    'Round open',
    'Experience (yrs)',
    'Location',
    'Notice (days)',
    'Score /100',
    'Joining',
    'Added',
    ...(internal ? ['Email', 'Phone', 'Current CTC', 'Expected CTC', 'Offered CTC'] : []),
  ];
  const exportCsv = () =>
    downloadText(
      `hiring-tracker-${view}-${iso(new Date())}.csv`,
      toCsv(
        head,
        rows.map((r) => [
          r.requestCode,
          r.candidateCode,
          r.candidateName,
          `${r.roleTitle} #${r.positionNumber}`,
          r.departmentName,
          r.spocName,
          SOURCE_LABEL[r.source] ?? r.source,
          STAGE_LABEL[r.stage] ?? r.stage,
          r.currentRound ? ROUND_LABEL[r.currentRound] : null,
          r.experienceYears,
          r.location,
          r.noticeDays,
          r.scoreTotal,
          r.joiningDate,
          r.addedOn,
          ...(internal ? [r.email, r.phone, r.currentCtc, r.expectedCtc, r.offeredCtc] : []),
        ]),
      ),
    );

  return (
    <section className={`${card} space-y-2 p-4`}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='text-base font-semibold text-slate-800'>{title}</h2>
        <button type='button' disabled={!rows.length} onClick={exportCsv} className={btn}>
          Export CSV
        </button>
      </div>
      {list.error && <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>}
      <div className='max-h-[480px] overflow-auto'>
        <table className='w-full min-w-[900px]'>
          <thead className='sticky top-0 border-b border-slate-200 bg-white'>
            <tr>
              <th className={th}>Candidate</th>
              <th className={th}>Role</th>
              <th className={th}>Stage</th>
              <th className={th}>Source</th>
              <th className={`${th} text-right`}>Exp.</th>
              <th className={th}>Location</th>
              <th className={`${th} text-right`}>Notice</th>
              <th className={`${th} text-right`}>Score</th>
              <th className={th}>Joining</th>
              {internal && <th className={th}>Contact</th>}
              {internal && <th className={`${th} text-right`}>CTC now → expected</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.applicationId} className='border-b border-slate-100'>
                <td className={td}>
                  <span className='font-medium text-slate-800'>{r.candidateName}</span>
                  <span className='block font-mono text-[11px] text-slate-400'>{r.candidateCode}</span>
                </td>
                <td className={td}>
                  {r.roleTitle} #{r.positionNumber}
                  <span className='block text-xs text-slate-400'>
                    {r.departmentName} · {r.spocName ?? '—'}
                  </span>
                </td>
                <td className={td}>
                  {STAGE_LABEL[r.stage] ?? r.stage}
                  {r.currentRound && (
                    <span className='block text-xs text-violet-700'>{ROUND_LABEL[r.currentRound]}</span>
                  )}
                </td>
                <td className={td}>{SOURCE_LABEL[r.source] ?? r.source}</td>
                <td className={`${td} text-right font-mono`}>{r.experienceYears ?? '—'}</td>
                <td className={td}>{r.location ?? '—'}</td>
                <td className={`${td} text-right font-mono`}>{r.noticeDays ?? '—'}</td>
                <td className={`${td} text-right font-mono`}>{r.scoreTotal ?? '—'}</td>
                <td className={td}>{r.joiningDate ? longDate(r.joiningDate) : '—'}</td>
                {internal && (
                  <td className={`${td} text-xs text-slate-600`}>
                    {[r.phone, r.email].filter(Boolean).join(' · ') || '—'}
                  </td>
                )}
                {internal && (
                  <td className={`${td} text-right text-xs`}>
                    {r.currentCtc !== null ? rupees(r.currentCtc) : '—'} →{' '}
                    {r.expectedCtc !== null ? rupees(r.expectedCtc) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {list.isSuccess && rows.length === 0 && (
          <p className='py-6 text-center text-sm text-slate-400'>No candidates yet.</p>
        )}
      </div>
    </section>
  );
};

/** HR → Hiring → Reports: the activity report, pending actions and both trackers. */
const HiringReports = () => {
  const [view, setView] = useState<TrackerView>('internal');
  return (
    <div className='space-y-4'>
      <ActivityReport />
      <PendingActions />
      <div className='flex rounded-lg bg-slate-100 p-0.5 text-xs'>
        {(['internal', 'external'] as const).map((v) => (
          <button
            key={v}
            type='button'
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 ${view === v ? 'bg-white font-semibold text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >
            {v === 'internal' ? 'Internal tracker (TA / HR)' : 'External tracker (no contacts / CTC)'}
          </button>
        ))}
      </div>
      <TrackerTable
        key={view}
        view={view}
        title={view === 'internal' ? 'Internal hiring tracker' : 'External hiring tracker'}
      />
    </div>
  );
};

export default HiringReports;

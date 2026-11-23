import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { DailyKpi, DailyKpiRow, StripStatus } from '@app-types/api.types';
import PageTabs from '@components/Common/Tabs/PageTabs.component';
import { dailyKpiApi } from '@services/api/dailyKpi.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';
import { holdsPortal } from '@utils/sections';

type Tab = 'me' | 'team' | 'org';

const MAX_DAYS_BACK = 60;
const todayIso = () => new Date().toLocaleDateString('en-CA');
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

/** Each strip day: a word and a style — never colour alone. */
const STRIP: Record<StripStatus, { label: string; mark: string; className: string }> = {
  done: {
    label: 'Written',
    mark: '✓',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  late_approved: {
    label: 'Filled in late',
    mark: '✓',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  late_pending: {
    label: 'Late, waiting for the manager',
    mark: '…',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  missed: { label: 'Missed', mark: '✕', className: 'bg-red-50 text-red-700 border-red-200' },
  today: {
    label: 'Not written yet',
    mark: '·',
    className: 'bg-white text-slate-500 border-slate-300 border-dashed',
  },
  leave: { label: 'On leave', mark: '–', className: 'bg-slate-50 text-slate-500 border-slate-200' },
  holiday: {
    label: 'Holiday',
    mark: '–',
    className: 'bg-slate-50 text-slate-500 border-slate-200',
  },
  weekend: {
    label: 'Week off',
    mark: '–',
    className: 'bg-slate-50 text-slate-500 border-slate-200',
  },
  not_joined: {
    label: 'Before joining',
    mark: '–',
    className: 'bg-slate-50 text-slate-500 border-slate-200',
  },
};

const ATTENDANCE_LABEL: Record<string, string> = {
  present: 'Present',
  wfh: 'Remote',
  half_day: 'Half day (no check-out)',
  absent: 'Absent',
  leave: 'On leave',
  half_leave: 'Half-day leave',
  holiday: 'Holiday',
  weekend: 'Week off',
  none: 'No mark yet',
};

const attendanceText = (r: DailyKpiRow) =>
  r.attendance.status === 'holiday' && r.attendance.holidayName
    ? `Holiday — ${r.attendance.holidayName}`
    : (ATTENDANCE_LABEL[r.attendance.status] ?? r.attendance.status);

const updateText = (r: DailyKpiRow) =>
  r.update.status === 'done' || r.update.status === 'late_approved'
    ? r.update.score !== null
      ? `Written · ${r.update.score}/100`
      : 'Written · unscored'
    : STRIP[r.update.status].label;

const Tile = ({
  label,
  value,
  note,
  bad,
}: {
  label: string;
  value: string;
  note?: string;
  bad?: boolean;
}) => (
  <div className={`rounded-xl border bg-white p-4 ${bad ? 'border-red-300' : 'border-slate-200'}`}>
    <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
      {label}
      {bad && <span className='ml-1.5 text-red-600'>⚠</span>}
    </p>
    <p className='mt-1 text-lg font-semibold text-slate-800'>{value}</p>
    {note && <p className='text-xs text-slate-500'>{note}</p>}
  </div>
);

const has = (r: DailyKpiRow, code: DailyKpiRow['alerts'][number]['code']) =>
  r.alerts.some((a) => a.code === code);

/** Days from the chosen date to the cycle's end (0 on the last day); null once it ended. */
const daysLeftIn = (data: DailyKpi) => {
  const left = Math.round(
    (Date.parse(`${data.cycle.endDate}T00:00:00`) - Date.parse(`${data.date}T00:00:00`)) /
      86_400_000,
  );
  return left < 0 ? null : left;
};

/** Wrote an update the working day before the chosen date (from the 7-day strip). */
const wroteYesterday = (r: DailyKpiRow, date: string) => {
  const prev = [...r.strip].reverse().find((s) => s.date < date);
  if (!prev || !['done', 'late_approved', 'missed', 'late_pending'].includes(prev.status))
    return null; // not a working day for them
  return prev.status === 'done' || prev.status === 'late_approved';
};

/** Your own day: the alert banner, the 7-day strip and seven tiles. */
const MyDay = ({
  data,
  today,
  onPick,
}: {
  data: DailyKpi;
  today: string;
  onPick: (date: string) => void;
}) => {
  const r = data.rows[0];
  if (!r) return null;
  const isToday = data.date === today;
  const pct = r.recentUpdates.workingDays
    ? Math.round((r.recentUpdates.done / r.recentUpdates.workingDays) * 100)
    : null;
  const left = daysLeftIn(data);
  return (
    <div className='space-y-4'>
      <p className='flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600'>
        <span>
          {data.cycle.name}:{' '}
          <span className='font-semibold text-slate-800'>
            {left === null ? 'ended' : left === 0 ? 'last day' : `${left} days left`}
          </span>
        </span>
        <span>
          Last 7 days:{' '}
          <span className='font-semibold text-slate-800'>
            {r.recentHours.avg === null ? '—' : `${r.recentHours.avg}h a day`}
          </span>
          {r.recentHours.days > 0 && (
            <span className='text-xs text-slate-500'> (over {r.recentHours.days} days)</span>
          )}
        </span>
      </p>
      {!r.employed ? (
        <p className='rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500'>
          This day is before your joining date — nothing to judge.
        </p>
      ) : r.alerts.length > 0 ? (
        <div className='rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800'>
          <p className='font-semibold'>
            ⚠ {r.alerts.length} {r.alerts.length === 1 ? 'thing needs' : 'things need'} attention
          </p>
          <ul className='mt-1 list-disc pl-5'>
            {r.alerts.map((a) => (
              <li key={a.code}>{a.title}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className='rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'>
          ✓ Nothing flagged — the record is clean
          {isToday ? ' so far (the day isn’t over yet).' : '.'}
        </p>
      )}

      <div className='flex flex-wrap gap-2'>
        {r.strip.map((d) => {
          const s = STRIP[d.status];
          return (
            <button
              key={d.date}
              type='button'
              onClick={() => onPick(d.date)}
              title={`${longDate(d.date)}: ${s.label}`}
              className={`flex w-16 flex-col items-center rounded-lg border px-2 py-1.5 text-xs ${s.className} ${
                d.date === data.date ? 'ring-2 ring-brand-500' : ''
              }`}
            >
              <span>
                {new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <span className='text-base font-semibold'>{s.mark}</span>
              <span className='text-xs'>{Number(d.date.slice(8))}</span>
            </button>
          );
        })}
      </div>

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        <Tile label='Work update' value={updateText(r)} bad={has(r, 'no_update')} />
        <Tile
          label='Attendance'
          value={attendanceText(r)}
          note={
            r.attendance.checkInAt
              ? `${time(r.attendance.checkInAt)} → ${time(r.attendance.checkOutAt)}${r.attendance.remote ? ' · remote' : ''}`
              : undefined
          }
          bad={has(r, 'absent')}
        />
        <Tile
          label='Hours'
          value={r.attendance.workedHours !== null ? `${r.attendance.workedHours}h` : '—'}
          note={`Short day under ${data.shortDayBelowHours}h`}
          bad={has(r, 'short_day')}
        />
        <Tile
          label='Goals at risk'
          value={r.goals.count === 0 ? 'No goals yet' : `${r.goals.atRisk} of ${r.goals.count}`}
          note='Under 40% with under 30 days to go'
          bad={has(r, 'goals_at_risk')}
        />
        <Tile
          label='Goal attainment'
          value={r.goals.attainment === null ? '—' : `${r.goals.attainment}%`}
          note={`Target ${r.targets.attainmentPct}% from mid-quarter · ${data.cycle.name}`}
          bad={has(r, 'attainment_below_target')}
        />
        <Tile
          label='Goal progress moved'
          value={
            r.goals.count === 0
              ? 'No goals yet'
              : `${r.goals.moved} ${r.goals.moved === 1 ? 'goal' : 'goals'}`
          }
          note='Goals you moved the progress of on this day'
        />
        <Tile
          label='Updates, last 7 working days'
          value={`${r.recentUpdates.done} of ${r.recentUpdates.workingDays}`}
          note={`${pct === null ? 'No working days yet' : `${pct}%`} · target ${r.targets.updatesOnTimePct}%`}
          bad={has(r, 'updates_below_target')}
        />
      </div>
      {r.targets.kpi && (
        <p className='text-sm text-slate-600'>
          <span className='font-medium text-slate-700'>
            {r.employee.department} is measured on:
          </span>{' '}
          {r.targets.kpi}
        </p>
      )}
    </div>
  );
};

/** Team / everyone: one row per person, worst first. */
const PeopleTable = ({ data }: { data: DailyKpi }) => {
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [search, setSearch] = useState('');
  const rows = data.rows.filter(
    (r) =>
      (!onlyFlagged || r.alerts.length > 0) &&
      `${r.employee.name} ${r.employee.department ?? ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const flagged = data.rows.filter((r) => r.alerts.length > 0).length;
  const movedGoals = data.rows.filter((r) => r.goals.moved > 0).length;
  const written = data.rows.filter(
    (r) => r.update.status === 'done' || r.update.status === 'late_approved',
  ).length;
  const present = data.rows.filter((r) =>
    ['present', 'wfh', 'half_day'].includes(r.attendance.status),
  ).length;
  // The working day before: counted over people for whom it WAS a working day.
  const yesterday = data.rows.map((r) => wroteYesterday(r, data.date)).filter((w) => w !== null);
  const wroteY = yesterday.filter(Boolean).length;
  const hoursRows = data.rows.filter((r) => r.recentHours.avg !== null);
  const teamAvg = hoursRows.length
    ? Math.round(
        (hoursRows.reduce((n, r) => n + (r.recentHours.avg as number), 0) / hoursRows.length) * 10,
      ) / 10
    : null;
  const left = daysLeftIn(data);

  if (data.rows.length === 0) {
    return <p className='text-sm text-slate-500'>Nobody to show here.</p>;
  }
  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-4 text-sm text-slate-600'>
        <span>
          <span className='font-semibold text-slate-800'>{present}</span> of {data.rows.length} in
        </span>
        <span>
          <span className='font-semibold text-slate-800'>{written}</span> wrote an update
        </span>
        <span>
          <span className='font-semibold text-slate-800'>{wroteY}</span>
          {yesterday.length > 0 && <> of {yesterday.length}</>} wrote one the day before
        </span>
        <span title='Average of each person’s average hours over the last 7 days'>
          avg <span className='font-semibold text-slate-800'>{teamAvg ?? '—'}</span>
          {teamAvg !== null && 'h'} over 7 days
        </span>
        <span title='People who moved the progress of at least one goal on this day'>
          <span className='font-semibold text-slate-800'>{movedGoals}</span> moved goal progress
        </span>
        <span>
          <span className='font-semibold text-red-700'>{flagged}</span> flagged
        </span>
        <span className='text-slate-500'>
          {data.cycle.name}: {left === null ? 'ended' : `${left} days left`}
        </span>
        <span className='ml-auto flex items-center gap-3'>
          <input
            aria-label='Search name or department'
            type='search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search name or department'
            className='rounded-md border border-slate-300 px-3 py-1.5 text-sm'
          />
          <label className='flex items-center gap-1.5'>
            <input
              type='checkbox'
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
            />
            Only flagged
          </label>
        </span>
      </div>
      <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white'>
        <table className='w-full min-w-[56rem] text-left text-sm'>
          <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
            <tr>
              <th className='px-4 py-3'>Person</th>
              <th className='px-4 py-3'>Attendance</th>
              <th className='px-4 py-3'>Update</th>
              <th className='px-4 py-3'>Hours</th>
              <th className='px-4 py-3' title='Average over the last 7 days (days with hours only)'>
                7-day avg
              </th>
              <th className='px-4 py-3'>Last 7 working days</th>
              <th className='px-4 py-3'>Attainment</th>
              <th className='px-4 py-3'>Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.employee.id}
                className={`border-t border-slate-100 align-top ${r.alerts.length > 0 ? 'bg-red-50/40' : ''}`}
              >
                <td className='px-4 py-3'>
                  <p className='font-medium text-slate-800'>{r.employee.name}</p>
                  <p className='text-xs text-slate-500'>
                    {r.employee.department ?? 'No department'}
                  </p>
                </td>
                <td className={`px-4 py-3 ${has(r, 'absent') ? 'text-red-700' : 'text-slate-600'}`}>
                  {attendanceText(r)}
                </td>
                <td
                  className={`px-4 py-3 ${has(r, 'no_update') ? 'text-red-700' : 'text-slate-600'}`}
                >
                  {r.employed ? updateText(r) : 'Before joining'}
                </td>
                <td
                  className={`px-4 py-3 tabular-nums ${has(r, 'short_day') ? 'text-red-700' : 'text-slate-600'}`}
                >
                  {r.attendance.workedHours !== null ? `${r.attendance.workedHours}h` : '—'}
                </td>
                <td className='px-4 py-3 tabular-nums text-slate-600'>
                  {r.recentHours.avg !== null ? `${r.recentHours.avg}h` : '—'}
                </td>
                <td
                  className={`px-4 py-3 tabular-nums ${has(r, 'updates_below_target') ? 'text-red-700' : 'text-slate-600'}`}
                >
                  {r.recentUpdates.done}/{r.recentUpdates.workingDays}
                  <span className='text-xs text-slate-500'>
                    {' '}
                    · target {r.targets.updatesOnTimePct}%
                  </span>
                </td>
                <td className='px-4 py-3'>
                  {r.goals.attainment === null ? (
                    <span className='text-slate-500'>{r.goals.count === 0 ? 'No goals' : '—'}</span>
                  ) : (
                    <div className='w-28'>
                      <div className='flex justify-between text-xs tabular-nums'>
                        <span
                          className={
                            has(r, 'attainment_below_target') ? 'text-red-700' : 'text-slate-700'
                          }
                        >
                          {r.goals.attainment}%
                        </span>
                        <span className='text-slate-500'>target {r.targets.attainmentPct}%</span>
                      </div>
                      <div className='relative mt-1 h-1.5 rounded-full bg-slate-100'>
                        <div
                          className='h-full rounded-full bg-[var(--series-1)]'
                          style={{ width: `${Math.min(100, r.goals.attainment)}%` }}
                        />
                        <div
                          className='absolute -top-0.5 h-2.5 w-0.5 bg-slate-500'
                          style={{ left: `${r.targets.attainmentPct}%` }}
                          title={`Target ${r.targets.attainmentPct}%`}
                        />
                      </div>
                    </div>
                  )}
                </td>
                <td className='px-4 py-3 text-xs'>
                  {r.alerts.length === 0 ? (
                    <span className='text-emerald-700'>✓ clean</span>
                  ) : (
                    <ul className='space-y-0.5 text-red-700'>
                      {r.alerts.map((a) => (
                        <li key={a.code}>⚠ {a.title}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className='px-4 py-6 text-center text-slate-500'>
                  Nobody matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Daily KPI (learner, 2026-11-16): a day against the record. Nothing here is
 * typed in — attendance, work updates and goals are held against the
 * department's targets (Settings → People → Department KPI targets).
 * Everyone sees their own day; managers their team; HR everyone.
 */
const DailyKpiPage = () => {
  const today = todayIso();
  const oldest = shift(today, -MAX_DAYS_BACK);
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<Tab>('me');
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isHr = me.data ? holdsPortal(me.data, 'HRBP') : false;
  const isRm = !!me.data?.hasReports;

  const fetchers = { me: dailyKpiApi.mine, team: dailyKpiApi.team, org: dailyKpiApi.org };
  const view = useQuery({
    queryKey: ['daily-kpi', tab, date],
    queryFn: () => fetchers[tab](date),
  });

  const tabs = useMemo(
    () => [
      { key: 'me' as const, label: 'My day' },
      ...(isRm ? [{ key: 'team' as const, label: 'My team' }] : []),
      ...(isHr ? [{ key: 'org' as const, label: 'Everyone' }] : []),
    ],
    [isRm, isHr],
  );

  return (
    <div className='w-full space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Daily KPI</h1>
        <p className='text-sm text-slate-500'>
          A day against the record — read from attendance, work updates and goals. Nothing here is
          typed in.
        </p>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <button
          type='button'
          onClick={() => setDate(shift(date, -1))}
          disabled={date <= oldest}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40'
          aria-label='Previous day'
        >
          ◀
        </button>
        <input
          aria-label='Date'
          type='date'
          value={date}
          min={oldest}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-sm'
        />
        <button
          type='button'
          onClick={() => setDate(shift(date, 1))}
          disabled={date >= today}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40'
          aria-label='Next day'
        >
          ▶
        </button>
        {date !== today && (
          <button
            type='button'
            onClick={() => setDate(today)}
            className='rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200'
          >
            Today
          </button>
        )}
        <span className='text-sm text-slate-600'>{longDate(date)}</span>
      </div>

      {tabs.length > 1 && <PageTabs<Tab> tabs={tabs} active={tab} onChange={setTab} />}

      {view.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {view.error && <p className='text-sm text-red-600'>{apiErrorMessage(view.error)}</p>}
      {view.data && tab === 'me' && <MyDay data={view.data} today={today} onPick={setDate} />}
      {view.data && tab !== 'me' && <PeopleTable data={view.data} />}
    </div>
  );
};

export default DailyKpiPage;

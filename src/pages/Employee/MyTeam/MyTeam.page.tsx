import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import type {
  AttendanceDay,
  DailyKpiRow,
  EmployeeAttendance,
  TeamMember,
} from '@app-types/api.types';
import FeedbackModal, {
  type FeedbackDraft,
} from '@components/Employee/Home/FeedbackModal.component';
import PersonSheet from '@components/Employee/MyTeam/PersonSheet.component';
import TalkNext from '@components/Employee/MyTeam/TalkNext.component';
import { rankTalkNext } from '@components/Employee/MyTeam/talkNext';
import TeamExits from '@components/Employee/MyTeam/TeamExits.component';
import { ProbationReviews } from '@components/Common/Probation/Probation.component';
import {
  TEAM_ATTENDANCE_ROUTE,
  TEAM_LEAVES_ROUTE,
} from '@constants/Common/navigation/routes.constants';
import { attendanceApi } from '@services/api/attendance.api';
import { careerApi } from '@services/api/career.api';
import { dailyKpiApi } from '@services/api/dailyKpi.api';
import { leavesApi } from '@services/api/leaves.api';
import { meApi } from '@services/api/me.api';
import { trainingsApi } from '@services/api/trainings.api';
import { apiErrorMessage } from '@utils/apiError';
import { attendancePct } from '@utils/attendance';
import { tenureOf } from '@utils/tenure';

const NO_DEPT = '__none__';
const selectClass = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** Employment status as a pill: notice is the word people use for `exiting`. */
const STATUS_LOOK: Record<TeamMember['status'], { label: string; cls: string }> = {
  active: { label: 'active', cls: 'bg-green-50 text-green-700' },
  invited: { label: 'invited', cls: 'bg-violet-50 text-violet-700' },
  exiting: { label: 'on notice', cls: 'bg-amber-50 text-amber-700' },
};

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
const todayStr = () => new Date().toLocaleDateString('en-CA');
const plusDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/**
 * Today's one-word state for a person, from their classified day. Invited
 * people have no attendance at all (team queries cover active employees),
 * so they get a status tag, not a misleading "no data".
 */
const todayChip = (
  day: AttendanceDay | undefined,
  status: TeamMember['status'],
): { label: string; cls: string } => {
  if (status === 'invited') return { label: 'invited', cls: 'bg-violet-50 text-violet-700' };
  if (!day) return { label: 'no data', cls: 'bg-slate-100 text-slate-500' };
  switch (day.status) {
    case 'holiday':
      return { label: 'holiday', cls: 'bg-slate-100 text-slate-500' };
    case 'weekend':
      return { label: 'weekend', cls: 'bg-slate-100 text-slate-500' };
    case 'leave':
    case 'half_leave':
      return { label: 'on leave', cls: 'bg-blue-50 text-blue-700' };
    case 'wfh':
      return { label: 'remote', cls: 'bg-blue-50 text-blue-700' };
    case 'half_day':
      return { label: 'half-day', cls: 'bg-orange-50 text-orange-700' };
    case 'present':
      return { label: `in ${time(day.checkInAt)}`, cls: 'bg-green-50 text-green-700' };
    case 'absent':
      return { label: 'absent', cls: 'bg-red-50 text-red-700' };
    default:
      return day.checkInAt
        ? { label: `in ${time(day.checkInAt)}`, cls: 'bg-green-50 text-green-700' }
        : { label: 'not in yet', cls: 'bg-slate-100 text-slate-500' };
  }
};

const pctClass = (pct: number) =>
  pct >= 90 ? 'text-emerald-700' : pct >= 75 ? 'text-amber-700' : 'text-red-700';

const AttendanceCell = ({ days, today }: { days: AttendanceDay[]; today: string }) => {
  const a = attendancePct(days, today);
  if (!a) return <span className='text-slate-400'>—</span>;
  return (
    <span className={pctClass(a.pct)} title={`${a.got} of ${a.of} working days this month`}>
      {a.pct}%
    </span>
  );
};

/** Updates on the last 7 working days, red when under the department target. */
const UpdatesCell = ({ row }: { row: DailyKpiRow | undefined }) => {
  if (!row) return <span className='text-slate-400'>—</span>;
  const u = row.recentUpdates;
  if (u.workingDays === 0) return <span className='text-slate-400'>new</span>;
  const below = (u.done / u.workingDays) * 100 < row.targets.updatesOnTimePct;
  return (
    <span
      className={below ? 'text-red-700' : 'text-slate-700'}
      title={`Target ${row.targets.updatesOnTimePct}% of working days`}
    >
      {u.done}/{u.workingDays}
    </span>
  );
};

/**
 * The manager's roster (design doc §2.2): everyone in the caller's chain —
 * reports and approver-only assignees — with their live state today, who's
 * away this week, and jump-offs to the queues. Approvals stay on the Team
 * pages; exceptions stay on Home; this page is about the PEOPLE.
 */
const MyTeamPage = ({ embedded = false }: { embedded?: boolean }) => {
  const month = currentMonth();
  const today = todayStr();
  const weekEnd = plusDays(today, 7);
  const weekAgo = plusDays(today, -7);
  // The past-7-days window can start in last month — load that month too.
  const lastMonth = weekAgo.slice(0, 7) !== month ? weekAgo.slice(0, 7) : null;
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [person, setPerson] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');

  const team = useQuery({ queryKey: ['my-team'], queryFn: meApi.team });
  const attendance = useQuery({
    queryKey: ['team-attendance', month],
    queryFn: () => attendanceApi.team(month),
  });
  const lastMonthAttendance = useQuery({
    queryKey: ['team-attendance', lastMonth],
    queryFn: () => attendanceApi.team(lastMonth!),
    enabled: lastMonth !== null,
  });
  const teamLeaves = useQuery({ queryKey: ['team-leaves'], queryFn: leavesApi.listTeam });
  const teamWfh = useQuery({ queryKey: ['team-wfh'], queryFn: attendanceApi.teamWfh });
  // The same day-against-the-record numbers as Daily KPI → My team (today).
  const kpi = useQuery({
    queryKey: ['daily-kpi', 'team', today],
    queryFn: () => dailyKpiApi.team(today),
  });
  const career = useQuery({ queryKey: ['career-team'], queryFn: careerApi.team });
  const trainings = useQuery({ queryKey: ['trainings-team'], queryFn: trainingsApi.team });

  if (team.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (team.error) return <p className='text-sm text-red-600'>{apiErrorMessage(team.error)}</p>;

  const members = team.data ?? [];
  const departments = [...new Set(members.map((m) => m.department ?? NO_DEPT))].sort((a, b) =>
    a === NO_DEPT ? 1 : b === NO_DEPT ? -1 : a.localeCompare(b),
  );
  const needle = search.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      (!dept || (m.department ?? NO_DEPT) === dept) &&
      (!needle ||
        [m.name, m.employeeCode, m.designation ?? ''].some((s) =>
          s.toLowerCase().includes(needle),
        )),
  );
  const monthFor = (id: string): AttendanceDay[] =>
    (attendance.data ?? []).find((m: EmployeeAttendance) => m.employee.id === id)?.days ?? [];
  const dayFor = (id: string): AttendanceDay | undefined =>
    monthFor(id).find((d) => d.date === today);
  const kpiFor = (id: string) => kpi.data?.rows.find((r) => r.employee.id === id);
  const ranked = rankTalkNext(
    members,
    kpi.data?.rows ?? [],
    career.data ?? [],
    trainings.data ?? [],
  );

  // Out today: on leave (full or half) or absent, from today's classified day.
  const todayStates = members.map((m) => dayFor(m.id)?.status);
  const onLeaveToday = todayStates.filter((s) => s === 'leave' || s === 'half_leave').length;
  const absentToday = todayStates.filter((s) => s === 'absent').length;

  // Out in the past 7 days (today excluded): leave and absent days per person.
  const pastWeek = [...(lastMonthAttendance.data ?? []), ...(attendance.data ?? [])];
  const outLastWeek = members
    .map((m) => {
      const days = pastWeek
        .filter((a) => a.employee.id === m.id)
        .flatMap((a) => a.days)
        .filter((d) => d.date >= weekAgo && d.date < today);
      const leave = days.filter((d) => d.status === 'leave' || d.status === 'half_leave');
      const absent = days.filter((d) => d.status === 'absent');
      return { member: m, leave, absent };
    })
    .filter((o) => o.leave.length + o.absent.length > 0)
    .sort((a, b) => b.leave.length + b.absent.length - (a.leave.length + a.absent.length));

  const awayThisWeek = [
    ...(teamLeaves.data ?? [])
      .filter((l) => l.status === 'approved' && l.startDate < weekEnd && l.endDate >= today)
      .map((l) => ({
        key: `l:${l.id}`,
        name: l.employee.name,
        // Menstrual leave stays confidential on a screen others may see.
        what: l.type === 'menstrual' ? 'leave' : `${l.type} leave`,
        from: l.startDate,
        to: l.endDate,
      })),
    ...(teamWfh.data ?? [])
      .filter((w) => w.status === 'approved' && w.startDate < weekEnd && w.endDate >= today)
      .map((w) => ({
        key: `w:${w.id}`,
        name: w.employee.name,
        what: 'remote',
        from: w.startDate,
        to: w.endDate,
      })),
  ].sort((a, b) => a.from.localeCompare(b.from));

  const noteDraft = (m: { id: string; name: string }) =>
    setDraft({
      recipient: { id: m.id, name: m.name },
      type: 'appreciation',
      body: `Hi ${m.name.split(' ')[0]}, `,
    });

  return (
    <div className='w-full space-y-4'>
      <div>
        {!embedded && <h1 className='text-2xl font-semibold text-slate-800'>My team</h1>}
        <p className='text-sm text-slate-500'>
          {members.length} {members.length === 1 ? 'person' : 'people'} route to you — direct
          reports and leave-approver assignees.
          {attendance.data && members.length > 0 && (
            <span className='ml-1'>
              {onLeaveToday + absentToday === 0
                ? 'Nobody is out today.'
                : `${onLeaveToday + absentToday} out today (${onLeaveToday} on leave, ${absentToday} absent).`}
            </span>
          )}
        </p>
      </div>

      <TeamExits />
      <ProbationReviews title='Probation review due' />

      {awayThisWeek.length > 0 && (
        <div className='rounded-xl border border-blue-200 bg-blue-50 p-4'>
          <div className='text-sm font-semibold text-blue-800'>Away in the next 7 days</div>
          <div className='mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-blue-800'>
            {awayThisWeek.map((a) => (
              <span key={a.key}>
                <b>{a.name}</b> — {a.what} ·{' '}
                {a.from === a.to ? shortDate(a.from) : `${shortDate(a.from)} → ${shortDate(a.to)}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {outLastWeek.length > 0 && (
        <div className='rounded-xl border border-slate-200 bg-white p-4'>
          <div className='text-sm font-semibold text-slate-800'>Out in the past 7 days</div>
          <div className='mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700'>
            {outLastWeek.map((o) => (
              <span
                key={o.member.id}
                title={[...o.leave, ...o.absent]
                  .map((d) => d.date)
                  .sort()
                  .map(shortDate)
                  .join(', ')}
              >
                <b>{o.member.name}</b> —{' '}
                {[
                  o.leave.length > 0 && `${days(o.leave.length)} on leave`,
                  o.absent.length > 0 && `${days(o.absent.length)} absent`,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {members.length > 0 && kpi.data && career.data && (
        <TalkNext ranked={ranked} onOpen={setPerson} />
      )}

      {members.length > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search name, code, role…'
            className={`${selectClass} min-w-56`}
          />
          {departments.length > 1 && (
            <select className={selectClass} value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value=''>Every department</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === NO_DEPT ? 'No department' : d}
                </option>
              ))}
            </select>
          )}
          <span className='text-sm text-slate-500'>
            {shown.length} {shown.length === 1 ? 'person' : 'people'}
          </span>
          {(search || dept) && (
            <button
              type='button'
              onClick={() => {
                setSearch('');
                setDept('');
              }}
              className='text-sm text-brand-600 hover:underline'
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white'>
        <table className='w-full min-w-[64rem] text-left text-sm'>
          <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
            <tr>
              <th className='px-4 py-3'>Person</th>
              <th className='px-4 py-3'>Role</th>
              <th className='px-4 py-3'>Band</th>
              <th className='px-4 py-3' title='Time since the joining date'>
                Tenure
              </th>
              <th className='px-4 py-3'>Status</th>
              <th className='px-4 py-3'>Base</th>
              <th className='px-4 py-3'>Contact</th>
              <th className='px-4 py-3'>Today</th>
              <th
                className='px-4 py-3'
                title='Days present this month, up to today. Week offs, holidays and approved leave are left out; a half day counts 0.5.'
              >
                Attendance
              </th>
              <th
                className='px-4 py-3'
                title='Work updates on the last 7 working days before today (leave, holidays and days before joining left out).'
              >
                Updates
              </th>
              <th className='px-4 py-3'></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const chip = todayChip(dayFor(m.id), m.status);
              const status = STATUS_LOOK[m.status];
              return (
                <tr
                  key={m.id}
                  onClick={() => setPerson(m)}
                  className='cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50'
                  title={`Open ${m.name}'s sheet`}
                >
                  <td className='px-4 py-3'>
                    <div className='font-medium text-slate-800'>{m.name}</div>
                    <div className='text-xs text-slate-400'>
                      {m.employeeCode}
                      {m.relation === 'approver_only' && (
                        <span className='ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide'>
                          approver only
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-4 py-3 text-slate-600'>
                    {m.designation ?? '—'}
                    {m.department && <div className='text-xs text-slate-400'>{m.department}</div>}
                  </td>
                  <td className='px-4 py-3 text-slate-600'>{m.level}</td>
                  <td className='px-4 py-3 whitespace-nowrap text-slate-600'>
                    {tenureOf(m.dateOfJoining)}
                  </td>
                  <td className='px-4 py-3'>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className='px-4 py-3 text-slate-600'>{m.baseZone ?? '—'}</td>
                  <td className='px-4 py-3 text-xs text-slate-500'>
                    <div className='select-all'>{m.email}</div>
                    {m.phone && <div className='select-all'>{m.phone}</div>}
                  </td>
                  <td className='px-4 py-3'>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip.cls}`}>
                      {chip.label}
                    </span>
                  </td>
                  <td className='px-4 py-3 tabular-nums'>
                    <AttendanceCell days={monthFor(m.id)} today={today} />
                  </td>
                  <td className='px-4 py-3 tabular-nums'>
                    <UpdatesCell row={kpiFor(m.id)} />
                  </td>
                  <td className='px-4 py-3 text-right text-xs whitespace-nowrap'>
                    <Link
                      to={TEAM_ATTENDANCE_ROUTE}
                      onClick={(e) => e.stopPropagation()}
                      className='text-brand-600 hover:underline'
                    >
                      calendar
                    </Link>
                    <Link
                      to={TEAM_LEAVES_ROUTE}
                      onClick={(e) => e.stopPropagation()}
                      className='ml-3 text-brand-600 hover:underline'
                    >
                      requests
                    </Link>
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation();
                        noteDraft(m);
                      }}
                      className='ml-3 text-green-600 hover:underline'
                    >
                      send note
                    </button>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={11} className='px-4 py-8 text-center text-slate-400'>
                  {members.length === 0
                    ? 'Nobody routes to you yet.'
                    : 'Nobody matches these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {person && (
        <PersonSheet
          member={person}
          days={
            (attendance.data ?? []).find((m: EmployeeAttendance) => m.employee.id === person.id)
              ?.days ?? []
          }
          onClose={() => setPerson(null)}
          onNote={(m) => {
            setPerson(null);
            noteDraft(m);
          }}
        />
      )}
      {draft && <FeedbackModal draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
};

export default MyTeamPage;

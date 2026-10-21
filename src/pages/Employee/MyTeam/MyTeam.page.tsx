import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import type { AttendanceDay, EmployeeAttendance, TeamMember } from '@app-types/api.types';
import FeedbackModal, { type FeedbackDraft } from '@components/Employee/Home/FeedbackModal.component';
import PersonSheet from '@components/Employee/MyTeam/PersonSheet.component';
import TeamExits from '@components/Employee/MyTeam/TeamExits.component';
import { ProbationReviews } from '@components/Common/Probation/Probation.component';
import {
  TEAM_ATTENDANCE_ROUTE,
  TEAM_LEAVES_ROUTE,
} from '@constants/Common/navigation/routes.constants';
import { attendanceApi } from '@services/api/attendance.api';
import { leavesApi } from '@services/api/leaves.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
const todayStr = () => new Date().toLocaleDateString('en-CA');
const plusDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

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

/**
 * The manager's roster (design doc §2.2): everyone in the caller's chain —
 * reports and approver-only assignees — with their live state today, who's
 * away this week, and jump-offs to the queues. Approvals stay on the Team
 * pages; exceptions stay on Home; this page is about the PEOPLE.
 */
const MyTeamPage = () => {
  const month = currentMonth();
  const today = todayStr();
  const weekEnd = plusDays(today, 7);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [person, setPerson] = useState<TeamMember | null>(null);

  const team = useQuery({ queryKey: ['my-team'], queryFn: meApi.team });
  const attendance = useQuery({
    queryKey: ['team-attendance', month],
    queryFn: () => attendanceApi.team(month),
  });
  const teamLeaves = useQuery({ queryKey: ['team-leaves'], queryFn: leavesApi.listTeam });
  const teamWfh = useQuery({ queryKey: ['team-wfh'], queryFn: attendanceApi.teamWfh });

  if (team.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (team.error) return <p className='text-sm text-red-600'>{apiErrorMessage(team.error)}</p>;

  const members = team.data ?? [];
  const dayFor = (id: string): AttendanceDay | undefined =>
    (attendance.data ?? [])
      .find((m: EmployeeAttendance) => m.employee.id === id)
      ?.days.find((d) => d.date === today);

  const awayThisWeek = [
    ...(teamLeaves.data ?? [])
      .filter((l) => l.status === 'approved' && l.startDate < weekEnd && l.endDate >= today)
      .map((l) => ({
        key: `l:${l.id}`,
        name: l.employee.name,
        what: `${l.type} leave`,
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
        <h1 className='text-2xl font-semibold text-slate-800'>My team</h1>
        <p className='text-sm text-slate-500'>
          {members.length} {members.length === 1 ? 'person' : 'people'} route to you — direct
          reports and leave-approver assignees.
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

      <div className='overflow-hidden rounded-xl border border-slate-200 bg-white'>
        <table className='w-full text-left text-sm'>
          <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
            <tr>
              <th className='px-4 py-3'>Person</th>
              <th className='px-4 py-3'>Role</th>
              <th className='px-4 py-3'>Base</th>
              <th className='px-4 py-3'>Contact</th>
              <th className='px-4 py-3'>Today</th>
              <th className='px-4 py-3'></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const chip = todayChip(dayFor(m.id), m.status);
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
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className='px-4 py-8 text-center text-slate-400'>
                  Nobody routes to you yet.
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
          canStartPip
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

import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { attendanceApi } from '@services/api/attendance.api';
import { leavesApi } from '@services/api/leaves.api';
import TeamAttendancePage from '@pages/Employee/Attendance/TeamAttendance.page';
import TeamLeavesPage from '@pages/Employee/Leaves/TeamLeaves.page';
import MyTeamPage from '@pages/Employee/MyTeam/MyTeam.page';

const TABS = [
  { key: 'people', label: 'People' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/**
 * My team (RM): one place for the people who route to me — People (the team
 * list + person sheets), Attendance (calendar / summary + remote-work
 * requests to decide) and Leave (requests to decide). It merges the former
 * My team, Team attendance and Team leaves pages (learner, 2026-11-05);
 * the old URLs redirect here with ?tab=.
 */
const TeamHubPage = () => {
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: Tab = TABS.some((t) => t.key === asked) ? (asked as Tab) : 'people';

  // What is waiting on me per tab — the same queries the tabs use (cached).
  const leaves = useQuery({ queryKey: ['team-leaves'], queryFn: leavesApi.listTeam });
  const wfh = useQuery({ queryKey: ['team-wfh'], queryFn: attendanceApi.teamWfh });
  const waiting: Record<Tab, number> = {
    people: 0,
    attendance: (wfh.data ?? []).filter(
      (w) => w.status === 'pending' || w.status === 'partially_approved',
    ).length,
    leave: (leaves.data ?? []).filter(
      (l) =>
        (l.status === 'pending' || l.status === 'partially_approved') &&
        l.rmRequired &&
        !l.rmApprovedBy,
    ).length,
  };

  return (
    <div className='w-full space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>My team</h1>
      <div className='flex flex-wrap gap-2'>
        {TABS.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setParams(t.key === 'people' ? {} : { tab: t.key }, { replace: true })}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === t.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
            {waiting[t.key] > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 text-xs ${
                  tab === t.key ? 'bg-white/25' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {waiting[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === 'people' && <MyTeamPage embedded />}
      {tab === 'attendance' && <TeamAttendancePage embedded />}
      {tab === 'leave' && <TeamLeavesPage embedded />}
    </div>
  );
};

export default TeamHubPage;

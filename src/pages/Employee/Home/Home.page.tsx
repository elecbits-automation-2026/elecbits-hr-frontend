import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import {
  HR_ONBOARDING_ROUTE,
  HR_PAYROLL_ROUTE,
  HR_POLICIES_ROUTE,
  MY_ATTENDANCE_ROUTE,
  MY_LEAVES_ROUTE,
  MY_PAYSLIPS_ROUTE,
  MY_TEAM_ROUTE,
  PROFILE_ROUTE,
  TEAM_LEAVES_ROUTE,
} from '@constants/Common/navigation/routes.constants';
import TeamInsights from '@components/Employee/Home/TeamInsights.component';
import { attendanceApi } from '@services/api/attendance.api';
import { feedbackApi } from '@services/api/feedback.api';
import { leavesApi } from '@services/api/leaves.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';
import { holdsPortal } from '@utils/sections';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
const todayStr = () => new Date().toLocaleDateString('en-CA');
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const longDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/** Pure information — navigation lives in Quick actions, not in these cards. */
const StatCard = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className='rounded-xl border border-slate-200 bg-white p-4'>
    <div className='text-xs font-medium uppercase tracking-wide text-slate-400'>{label}</div>
    <div className='mt-1.5 text-sm text-slate-700'>{children}</div>
  </div>
);

const QuickAction = ({ to, title, hint }: { to: string; title: string; hint: string }) => (
  <Link
    to={to}
    className='block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300'
  >
    <div className='text-sm font-medium text-slate-800'>{title}</div>
    <div className='mt-0.5 text-xs text-slate-500'>{hint}</div>
  </Link>
);

/**
 * The employee dashboard: today's punch, the month at a glance, balances,
 * what's in flight, what's waiting on you (approvers), and the next holidays —
 * all read from the same queries the detail pages use, so the cache is shared.
 */
const HomePage = () => {
  const month = currentMonth();
  const year = Number(month.slice(0, 4));

  const { data: me, isLoading, error } = useQuery({ queryKey: ['me'], queryFn: meApi.get });
  const attendance = useQuery({
    queryKey: ['my-attendance', month],
    queryFn: () => attendanceApi.me(month),
  });
  const balances = useQuery({ queryKey: ['leave-balances'], queryFn: () => leavesApi.balances() });
  const myLeaves = useQuery({ queryKey: ['my-leaves'], queryFn: leavesApi.listMine });
  const myWfh = useQuery({ queryKey: ['my-wfh'], queryFn: attendanceApi.myWfh });
  const holidays = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => attendanceApi.holidays(year),
  });
  const notes = useQuery({ queryKey: ['feedback-mine'], queryFn: feedbackApi.mine });
  if (isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (error) return <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>;
  if (!me) return null;

  const today = attendance.data?.today ?? null;
  const summary = attendance.data?.summary;
  const live = ['pending', 'partially_approved'];
  const myOpenRequests =
    (myLeaves.data ?? []).filter((l) => live.includes(l.status)).length +
    (myWfh.data ?? []).filter((w) => live.includes(w.status)).length;
  const upcomingHolidays = (holidays.data ?? [])
    .filter((h) => h.date >= todayStr())
    .slice(0, 3);
  const nextLeave = (myLeaves.data ?? [])
    .filter((l) => l.status === 'approved' && l.startDate >= todayStr())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const remaining = (type: string) =>
    balances.data?.find((b) => b.type === type)?.remaining ?? '—';

  const subtitleParts = [
    me.designation,
    me.department?.name,
    me.baseZone?.name,
    me.manager ? `reports to ${me.manager.name}` : null,
  ].filter(Boolean);

  return (
    <div className='w-full space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>
          {greeting()}, {me.firstName ?? me.name}
        </h1>
        <p className='mt-0.5 text-sm text-slate-500'>
          {new Date().toLocaleDateString([], {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {subtitleParts.length > 0 && <> · {subtitleParts.join(' · ')}</>}
        </p>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {/* One attendance card: today's punch + the month, same data area. */}
        <StatCard label='Attendance'>
          <div>
            {today?.checkedIn ? (
              <>
                In <b>{time(today.checkInAt)}</b>
                {today.checkedOut ? (
                  <>
                    {' '}· Out <b>{time(today.checkOutAt)}</b>
                  </>
                ) : (
                  <span className='text-slate-400'> · not checked out</span>
                )}
              </>
            ) : (
              <span className='text-slate-400'>Not checked in yet</span>
            )}
          </div>
          <div className='mt-1 text-xs text-slate-500'>
            {summary ? (
              <>
                <b>{summary.present}</b> present · <b>{summary.leave}</b> leave ·{' '}
                <b className={summary.absent > 0 ? 'text-red-600' : ''}>{summary.absent}</b> absent
              </>
            ) : (
              'Loading…'
            )}
          </div>
        </StatCard>

        <StatCard label='Leave left'>
          Sick <b>{remaining('sick')}</b> · Earned <b>{remaining('earned')}</b> · Vacation{' '}
          <b>{remaining('vacation_family')}</b>
        </StatCard>

        <StatCard label='My open requests'>
          {myOpenRequests === 0 ? (
            <span className='text-slate-400'>Nothing awaiting approval</span>
          ) : (
            <>
              <b>{myOpenRequests}</b> awaiting approval
            </>
          )}
        </StatCard>
      </div>

      <div>
        <h2 className='mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400'>
          Quick actions
        </h2>
        {/* Role-based: everyone gets the self-service four; RMs gain their
            team doors; HRBP/PR batch holders gain their console doors. */}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <QuickAction
            to={MY_LEAVES_ROUTE}
            title='Request leave'
            hint='Sick, earned, vacation or unpaid — approvals follow the policy'
          />
          <QuickAction
            to={MY_ATTENDANCE_ROUTE}
            title='Check in / out'
            hint='Geo punch from any office zone, or request remote work'
          />
          <QuickAction
            to={MY_PAYSLIPS_ROUTE}
            title='My payslips'
            hint='Published payslips, month by month'
          />
          <QuickAction
            to={PROFILE_ROUTE}
            title='My profile'
            hint='Keep contacts, address and personal details current'
          />
          {me.hasReports && (
            <>
              <QuickAction
                to={TEAM_LEAVES_ROUTE}
                title='Team approvals'
                hint='Leave and remote requests waiting on your yes'
              />
              <QuickAction
                to={MY_TEAM_ROUTE}
                title='My team'
                hint="Your people: who's in, who's away, who needs a note"
              />
            </>
          )}
          {holdsPortal(me, 'HRBP') && (
            <>
              <QuickAction
                to={HR_ONBOARDING_ROUTE}
                title='Onboarding queue'
                hint="Who's onboarding, progress, and journeys to start"
              />
              <QuickAction
                to={HR_POLICIES_ROUTE}
                title='Policy tracker'
                hint='Who has signed what — and what needs re-signing'
              />
            </>
          )}
          {holdsPortal(me, 'PR') && (
            <QuickAction
              to={HR_PAYROLL_ROUTE}
              title='Payroll'
              hint='Runs, payslips and the month-end close'
            />
          )}
        </div>
      </div>

      {/* Exception-first team panel for RMs/approvers: waiting requests,
          late/absence patterns, and the two gap charts. Sources live in the
          pluggable src/insights registry. */}
      {me.hasReports && <TeamInsights />}

      <div>
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='text-sm font-semibold text-slate-700'>Coming up</h2>
          <ul className='mt-3 space-y-2 text-sm'>
            {nextLeave && (
              <li className='flex items-center justify-between'>
                <span>
                  Your <span className='capitalize'>{nextLeave.type}</span> leave
                  {nextLeave.startDate === nextLeave.endDate
                    ? ''
                    : ` (${nextLeave.days} days)`}
                </span>
                <span className='text-slate-500'>{longDate(nextLeave.startDate)}</span>
              </li>
            )}
            {upcomingHolidays.map((h) => (
              <li key={h.id} className='flex items-center justify-between'>
                <span>{h.name}</span>
                <span className='text-slate-500'>{longDate(h.date)}</span>
              </li>
            ))}
            {!nextLeave && upcomingHolidays.length === 0 && (
              <li className='text-slate-400'>No holidays or approved leave ahead this year.</li>
            )}
          </ul>
        </div>
        {/* The "Your access" batch-chip card was removed on purpose: listing
            who holds which batches on everyone's home bred peer comparison.
            Access is visible where it's managed — the Admin console. */}
      </div>

      {(notes.data?.length ?? 0) > 0 && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='text-sm font-semibold text-slate-700'>Notes from your manager</h2>
          <ul className='mt-3 space-y-3'>
            {(notes.data ?? []).slice(0, 5).map((n) => (
              <li key={n.id} className='text-sm'>
                <div className='flex items-baseline gap-2'>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      n.type === 'appreciation'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {n.type}
                  </span>
                  <span className='text-xs text-slate-400'>
                    {n.author.name} · {longDate(n.createdAt.slice(0, 10))}
                  </span>
                </div>
                <p className='mt-1 text-slate-700'>{n.body}</p>
                {n.evidence && (
                  <p className='mt-0.5 text-xs text-slate-400'>Based on: {n.evidence}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HomePage;

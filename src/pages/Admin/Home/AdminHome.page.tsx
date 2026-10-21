import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  ADMIN_AUDIT_ROUTE,
  ADMIN_BATCHES_ROUTE,
  ADMIN_GRANT_REQUESTS_ROUTE,
  ADMIN_INVITE_ROUTE,
  ADMIN_PUNCH_ZONES_ROUTE,
  ADMIN_SETTINGS_ROUTE,
  HR_ATTENDANCE_ROUTE,
  HR_LEAVES_ROUTE,
  HR_PAYROLL_ROUTE,
  HR_PEOPLE_ROUTE,
} from '@constants/Common/navigation/routes.constants';

/**
 * The Admin landing page is a MANUAL, not a dashboard of numbers: the
 * administration account is a concept that sets the rules (zones, holidays,
 * access), so its home answers "I want to do X — where do I go?" and walks a
 * first-time setup in order. Admin (Owner) bypasses every gate, so the HR
 * console links below work for it too.
 */

const TaskCard = ({
  task,
  how,
  to,
  cta,
}: {
  task: string;
  how: ReactNode;
  to: string;
  cta: string;
}) => (
  <div className='flex flex-col rounded-xl border border-slate-200 bg-white p-4'>
    <div className='font-medium text-slate-800'>{task}</div>
    <p className='mt-1 flex-1 text-sm text-slate-500'>{how}</p>
    <Link
      to={to}
      className='mt-3 inline-block w-fit rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500'
    >
      {cta} →
    </Link>
  </div>
);

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2 className='mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400'>{title}</h2>
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>{children}</div>
  </section>
);

const SETUP_STEPS = [
  {
    step: 'Add your punch zones',
    detail: 'Every office and the warehouse, each with its radius and working hours — attendance reads everything from these.',
  },
  {
    step: 'Set the holiday calendar',
    detail: 'Holidays never count as working days anywhere (leave, attendance, payroll).',
  },
  {
    step: 'Review the access batches',
    detail: 'HRBP and PR are seeded; duplicate and trim them for tailored roles before handing them out.',
  },
  {
    step: 'Invite people top-down',
    detail: 'Managers before their reports — the org chart can never be born broken. Copy each one-time claim link.',
  },
  {
    step: 'Enter salary terms',
    detail: 'Payroll skips anyone without a CTC, so PR should fill compensation before the first month-end run.',
  },
];

const RULES = [
  'This account is the administration, not a person — it has no attendance, leave or payslips of its own.',
  'Nobody edits their own access — not even this account. Batch edits apply to every holder instantly and are audited.',
  'Claim links are single-use and expire after the invite-link validity in Org settings (7 days by default); a lost link is reissued from HR → People, which kills the old one.',
  'Every grant, approval and payroll action writes an append-only audit row — salary amounts are never recorded there.',
];

const AdminHomePage = () => (
  <div className='w-full space-y-8'>
    <div>
      <h1 className='text-2xl font-semibold text-slate-800'>Admin console</h1>
      <p className='mt-1 max-w-2xl text-sm text-slate-500'>
        This account sets the rules the whole portal runs on. Find your task below — each card
        says where to go and what will happen.
      </p>
    </div>

    <Group title='People & onboarding'>
      <TaskCard
        task='Bring someone on board'
        how='Choose their manager, level, base location and access batches; you get a one-time claim link to send them.'
        to={ADMIN_INVITE_ROUTE}
        cta='Invite employee'
      />
      <TaskCard
        task='Look after existing records'
        how={
          <>
            The People roster: reissue a lost or expired invite link (the old one stops
            working), fill in records missing a joining date, department or designation, and
            request extra access for someone.
          </>
        }
        to={HR_PEOPLE_ROUTE}
        cta='Open People'
      />
    </Group>

    <Group title='Access & security'>
      <TaskCard
        task='Give, take away or tailor a role'
        how='Assign or revoke a batch on its card; changes hit the holder on their very next request. For a tailored role, duplicate the closest batch and tick or untick single actions.'
        to={ADMIN_BATCHES_ROUTE}
        cta='Access batches'
      />
      <TaskCard
        task='See who did what, when'
        how='The append-only audit log: every claim, grant, approval and payroll action, newest first.'
        to={ADMIN_AUDIT_ROUTE}
        cta='Audit log'
      />
      <TaskCard
        task='Review access requests'
        how='Requests raised for extra grants land here for a decision.'
        to={ADMIN_GRANT_REQUESTS_ROUTE}
        cta='Grant requests'
      />
    </Group>

    <Group title='Workplace rules'>
      <TaskCard
        task='Add an office or warehouse'
        how='Punch zones carry the geofence radius and that location&rsquo;s working hours — punctuality dots follow the person&rsquo;s base zone.'
        to={ADMIN_PUNCH_ZONES_ROUTE}
        cta='Punch zones'
      />
      <TaskCard
        task='Tune org-wide numbers'
        how='Award values, at-risk thresholds, work week, leave windows, PT and other knobs — each falls back to its built-in default until changed.'
        to={ADMIN_SETTINGS_ROUTE}
        cta='Org settings'
      />
      <TaskCard
        task='Manage the holiday calendar'
        how='Holidays live on the HR Attendance page, next to the org view and the remote-work queue.'
        to={HR_ATTENDANCE_ROUTE}
        cta='HR attendance'
      />
      <TaskCard
        task='Watch approvals move'
        how='Leave and remote-work queues show both approval slots (RM / HR) per request.'
        to={HR_LEAVES_ROUTE}
        cta='HR leaves'
      />
      <TaskCard
        task='Run or inspect payroll'
        how='Generate the month, review the draft (LOP, deductions, auto earned-leave cover), finalize to publish locked payslips.'
        to={HR_PAYROLL_ROUTE}
        cta='Payroll'
      />
    </Group>

    <section className='grid gap-4 lg:grid-cols-2'>
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>First-time setup, in order</h2>
        <ol className='mt-3 space-y-2.5'>
          {SETUP_STEPS.map((s, i) => (
            <li key={s.step} className='flex gap-3 text-sm'>
              <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-[11px] text-brand-600'>
                {i + 1}
              </span>
              <span>
                <span className='font-medium text-slate-700'>{s.step}.</span>{' '}
                <span className='text-slate-500'>{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>Rules this console lives by</h2>
        <ul className='mt-3 space-y-2.5'>
          {RULES.map((r) => (
            <li key={r} className='flex gap-2 text-sm text-slate-500'>
              <span className='text-brand-600'>•</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </section>
  </div>
);

export default AdminHomePage;

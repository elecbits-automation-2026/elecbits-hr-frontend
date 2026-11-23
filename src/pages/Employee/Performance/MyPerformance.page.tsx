import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import type {
  CreateGoalInput,
  Goal,
  GoalCategory,
  StripStatus,
  TeamGoalsRow,
  WorkUpdate,
} from '@app-types/api.types';
import FeedbackModal, {
  type FeedbackDraft,
} from '@components/Employee/Home/FeedbackModal.component';
import LateUpdateModal from '@components/Employee/Performance/LateUpdateModal.component';
import ManageGoalsModal from '@components/Employee/Performance/ManageGoalsModal.component';
import QuarterBoard from '@components/Common/QuarterReports/QuarterBoard.component';
import PageTabs from '@components/Common/Tabs/PageTabs.component';
import QuarterReportCard from '@components/Common/QuarterReports/QuarterReportCard.component';
import { MyPips } from '@components/Common/Pip/PipLists.component';
import { HR_HIRING_ROUTE } from '@constants/Common/navigation/routes.constants';
import { GOAL_CATEGORY_LABELS } from '@constants/Common/quarter.constants';
import { quarterReportsApi } from '@services/api/quarterReports.api';
import { meApi } from '@services/api/me.api';
import { performanceApi } from '@services/api/performance.api';
import { apiErrorMessage } from '@utils/apiError';
import QueryError from '@components/Common/Utilities/QueryError.component';
import ModalShell from '@components/Common/Utilities/ModalShell.component';

const DAY_MS = 86_400_000;
const localDate = (d: Date) => d.toLocaleDateString('en-CA');
const todayStr = () => localDate(new Date());

/** The update strip's colours and words — the server classifies each day. */
const STRIP_LOOK: Record<StripStatus, { cls: string; label: string }> = {
  done: { cls: 'bg-green-500', label: 'submitted' },
  late_approved: { cls: 'bg-green-300', label: 'filled in late — approved' },
  late_pending: {
    cls: 'bg-amber-200 ring-1 ring-amber-400',
    label: 'filled in late — waiting for your manager',
  },
  missed: {
    cls: 'bg-red-300 hover:bg-red-400 cursor-pointer',
    label: 'missed — click to fill it in',
  },
  leave: { cls: 'bg-sky-200', label: 'on leave' },
  holiday: { cls: 'bg-slate-200', label: 'holiday' },
  weekend: { cls: 'bg-slate-100', label: 'weekend' },
  today: { cls: 'bg-amber-300', label: 'due today' },
  not_joined: { cls: 'bg-transparent', label: 'before you joined' },
};

/** What a grid day reads as, from the manager's side (the strip is the server's). */
const GRID_LABEL: Record<StripStatus, string> = {
  done: 'update written',
  late_approved: 'filled in late — approved',
  late_pending: 'filled in late — waiting for you',
  missed: 'missed',
  leave: 'on leave',
  holiday: 'holiday',
  weekend: 'weekend',
  today: 'due today',
  not_joined: 'before they joined',
};

/** The strip colours without their own-view click affordances. */
const gridColour = (s: StripStatus) =>
  STRIP_LOOK[s].cls.replace('hover:bg-red-400 cursor-pointer', '').trim();

/**
 * The manager's sheet: one row per person, one cell per day (last 7 days),
 * coloured like the person's own strip. A cell with an entry opens that
 * day's update; the name opens their last five.
 */
const TeamUpdatesGrid = ({
  rows,
  onPerson,
  onDay,
}: {
  rows: Array<{
    employee: { id: string; name: string };
    updates: WorkUpdate[];
    strip: Array<{ date: string; status: StripStatus }>;
    missesThisMonth: number;
    overAllowance: boolean;
  }>;
  onPerson: (p: { id: string; name: string }) => void;
  onDay: (p: { id: string; name: string }, u: WorkUpdate) => void;
}) => {
  const dates = rows[0]?.strip.map((d) => d.date) ?? [];
  return (
    <div className='mt-3 overflow-x-auto'>
      <table className='w-full min-w-[36rem] text-left text-sm'>
        <thead className='text-xs text-slate-500'>
          <tr>
            <th className='py-1 pr-3 font-medium'>Person</th>
            {dates.map((d) => (
              <th key={d} className='px-1 py-1 text-center font-medium'>
                {new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: 'short' })}
                <div className='font-mono text-xs'>{d.slice(8)}</div>
              </th>
            ))}
            <th className='py-1 pl-3 font-medium'>Missed this month</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employee.id} className='border-t border-slate-100'>
              <td className='py-1.5 pr-3'>
                <button
                  type='button'
                  onClick={() => onPerson(r.employee)}
                  className='font-medium text-slate-700 hover:text-brand-600 hover:underline'
                >
                  {r.employee.name}
                </button>
              </td>
              {r.strip.map((d) => {
                const u = r.updates.find((x) => x.date === d.date);
                return (
                  <td key={d.date} className='px-1 py-1.5 text-center'>
                    <button
                      type='button'
                      disabled={!u}
                      onClick={() => u && onDay(r.employee, u)}
                      title={`${d.date} — ${GRID_LABEL[d.status]}${u && u.score !== null ? ` · score ${u.score}` : ''}${u ? ' — click to read' : ''}`}
                      className={`h-6 w-6 rounded ${gridColour(d.status)} ${u ? 'cursor-pointer ring-brand-400 hover:ring-2' : 'cursor-default'}`}
                    >
                      <span className='sr-only'>{GRID_LABEL[d.status]}</span>
                    </button>
                  </td>
                );
              })}
              <td className='py-1.5 pl-3'>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.overAllowance ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.missesThisMonth}
                  {r.overAllowance ? ' — over allowance' : ''}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className='mt-2 text-xs text-slate-500'>
        Green = written · red = missed · amber = due today or waiting for you · blue = leave. Hover
        a day for its status; click a filled one to read it.
      </p>
    </div>
  );
};

const wordCount = (text: string): number => {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
};

const daysLeft = (dueOn: string, today: string): number =>
  Math.round((Date.parse(dueOn) - Date.parse(today)) / DAY_MS);

/** "12 days left" / "due today" / "3 days overdue" — amber in the last 14 days, red once past. */
const DaysLeftTag = ({ dueOn, today }: { dueOn: string; today: string }) => {
  const n = daysLeft(dueOn, today);
  const cls = n < 0 ? 'text-red-700' : n <= 14 ? 'text-amber-700' : 'text-slate-500';
  const label =
    n < 0
      ? `${-n} ${n === -1 ? 'day' : 'days'} overdue`
      : n === 0
        ? 'due today'
        : `${n} ${n === 1 ? 'day' : 'days'} left`;
  return <span className={cls}>{label}</span>;
};

/** Mirrors the server's at-risk rule: under 40% with under 30 days to due. */
const isAtRisk = (g: Goal, today: string): boolean =>
  g.progress < 40 && daysLeft(g.dueOn, today) < 30;

const scoreTone = (score: number): string =>
  score >= 70
    ? 'text-green-700 bg-green-50'
    : score >= 40
      ? 'text-amber-700 bg-amber-50'
      : 'text-red-700 bg-red-50';

const EMPTY_GOAL: Omit<CreateGoalInput, 'employeeId'> = {
  title: '',
  weight: 25,
  category: 'fundamental',
};

/**
 * The performance page: own quarterly goals (progress is YOURS to move — the
 * goals themselves come from your manager), the daily work update, and — for
 * an RM — the team's goal sheet and update sheet. One attainment formula
 * everywhere: Σ(progress×weight)/Σweight.
 */
const MyPerformancePage = () => {
  const queryClient = useQueryClient();
  const today = todayStr();

  const mine = useQuery({ queryKey: ['my-goals'], queryFn: performanceApi.myGoals });
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const myUpdates = useQuery({
    queryKey: ['my-work-updates'],
    queryFn: () => performanceApi.myUpdates(14),
  });
  const teamGoals = useQuery({ queryKey: ['team-goals'], queryFn: performanceApi.teamGoals });
  const myReports = useQuery({
    queryKey: ['my-quarter-reports'],
    queryFn: quarterReportsApi.mine,
  });
  const teamUpdates = useQuery({
    queryKey: ['team-work-updates'],
    queryFn: () => performanceApi.teamUpdates(7),
  });
  // RM: late entries for missed days waiting for a decision.
  const lateQueue = useQuery({ queryKey: ['late-updates'], queryFn: performanceApi.lateQueue });
  const decideLate = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'decline' }) =>
      performanceApi.decideLate(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['late-updates'] });
      queryClient.invalidateQueries({ queryKey: ['team-work-updates'] });
    },
  });
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [lateFor, setLateFor] = useState<string | null>(null);
  const [managing, setManaging] = useState<{ id: string; name: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState<FeedbackDraft | null>(null);
  /** RM reaction to an update = a prefilled feedback note to that person. */
  const react = (person: { id: string; name: string }, date: string) =>
    setNoteDraft({
      recipient: person,
      type: 'appreciation',
      body: `Hi ${person.name.split(' ')[0]}, about your update on ${date}: `,
    });

  // ── Clicking a name in the team sections peeks at that person's LAST
  // FIVE work updates (30-day window) — a quick read, not the full sheet.
  const [peek, setPeek] = useState<{ id: string; name: string } | null>(null);
  // One day from the team grid: whose, and their entry.
  const [dayOpen, setDayOpen] = useState<{
    person: { id: string; name: string };
    update: WorkUpdate;
  } | null>(null);
  const peekUpdates = useQuery({
    queryKey: ['team-member-updates-peek', peek?.id],
    queryFn: () => performanceApi.teamMemberUpdates(peek!.id, 30),
    enabled: peek !== null,
  });
  const openSheet = (id: string, name: string) => setPeek({ id, name });

  // Progress sliders: local value while dragging, saved on release.
  const [dragging, setDragging] = useState<Record<string, number>>({});
  const progress = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) =>
      performanceApi.updateProgress(id, value),
    onSettled: (_data, _err, { id }) => {
      setDragging((d) => {
        const rest = { ...d };
        delete rest[id];
        return rest;
      });
      queryClient.invalidateQueries({ queryKey: ['my-goals'] });
    },
  });

  // Today's update editor — prefilled with today's note when one exists.
  const todays = myUpdates.data?.updates.find((u) => u.date === today) ?? null;
  const [note, setNote] = useState<string | null>(null);
  const draft = note ?? todays?.note ?? '';
  const [tags, setTags] = useState<string[] | null>(null);
  const tagged = tags ?? todays?.goalIds ?? [];
  const submit = useMutation({
    mutationFn: (text: string) =>
      performanceApi.submitUpdate({ note: text, ...(tagged.length ? { goalIds: tagged } : {}) }),
    onSuccess: () => {
      setNote(null);
      setTags(null);
      queryClient.invalidateQueries({ queryKey: ['my-work-updates'] });
    },
  });

  // RM: add-goal modal.
  const [goalFor, setGoalFor] = useState<TeamGoalsRow['employee'] | null>(null);
  const [goalDraft, setGoalDraft] = useState(EMPTY_GOAL);
  const createGoal = useMutation({
    mutationFn: (input: CreateGoalInput) => performanceApi.createGoal(input),
    onSuccess: () => {
      setGoalFor(null);
      setGoalDraft(EMPTY_GOAL);
      queryClient.invalidateQueries({ queryKey: ['team-goals'] });
      queryClient.invalidateQueries({ queryKey: ['my-goals'] });
      queryClient.invalidateQueries({ queryKey: ['team-member-goals'] });
    },
  });
  // The person's current weight total, for the running total in the add-goal
  // modal (their own goals come from my-goals when it's the caller).
  const goalForIsMe = goalFor !== null && goalFor.id === me.data?.id;
  const goalForGoals = useQuery({
    queryKey: ['team-member-goals', goalFor?.id],
    queryFn: () => performanceApi.teamMemberGoals(goalFor!.id),
    enabled: goalFor !== null && !goalForIsMe,
  });

  if (mine.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (mine.error) return <QueryError error={mine.error} />;
  if (!mine.data) return null;

  const g = mine.data;
  const strip = myUpdates.data?.strip ?? [];
  const lateWindowFloor = localDate(
    new Date(Date.now() - (myUpdates.data?.lateWindowDays ?? 14) * DAY_MS),
  );
  const goalTitle = new Map(g.goals.map((x) => [x.id, x.title]));
  const isRm = (teamGoals.data?.length ?? 0) > 0;
  const lateCount = lateQueue.data?.length ?? 0;
  // Mine | My team: an RM's team work gets its own tab; HR reach never shows
  // here (that lives under HR → Quarter reports).
  const hasTeam = isRm || !!me.data?.hasReports || lateCount > 0;
  const view = hasTeam ? tab : 'mine';

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h1 className='text-2xl font-semibold text-slate-800'>Goals &amp; updates</h1>
        <span className='flex items-center gap-2 text-sm text-slate-500'>
          <span className='rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700'>
            {g.cycle.name} ·{' '}
            {(() => {
              const n = Math.max(0, daysLeft(g.cycle.endDate, today));
              return `${n} ${n === 1 ? 'day' : 'days'} left`;
            })()}
          </span>
          {g.cycle.startDate} → {g.cycle.endDate}
        </span>
      </div>

      {hasTeam && (
        <PageTabs
          tabs={[
            { key: 'mine', label: 'Me' },
            { key: 'team', label: 'My team', count: lateCount },
          ]}
          active={view}
          onChange={setTab}
        />
      )}

      {view === 'mine' && <MyPips />}

      {/* ── Own goals ──────────────────────────────────────── */}
      {view === 'mine' && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <div className='flex flex-wrap items-baseline justify-between gap-2'>
            <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
              Goals this quarter
            </h2>
            {/* Self-governing (reports to Admin): nobody above sets their goals. */}
            {me.data?.selfGoverned && (
              <button
                type='button'
                onClick={() =>
                  setGoalFor({
                    id: me.data!.id,
                    name: me.data!.name,
                    employeeCode: me.data!.employeeCode,
                  })
                }
                className='rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-500'
              >
                + Add my goal
              </button>
            )}
            {g.attainment !== null && (
              <span className='text-sm text-slate-600'>
                Attainment <b className='text-slate-800'>{g.attainment}%</b>
                {g.atRisk > 0 && (
                  <span className='ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'>
                    {g.atRisk} at risk
                  </span>
                )}
              </span>
            )}
          </div>

          {g.departmentKpi && (
            <p className='mt-2 text-sm text-slate-600'>
              Your function is measured on:{' '}
              <span className='text-slate-800'>{g.departmentKpi}</span>
            </p>
          )}

          {g.goals.length > 0 && (
            <p className='mt-1 text-xs text-slate-500'>
              {g.goals.length} {g.goals.length === 1 ? 'goal' : 'goals'} · weights total{' '}
              <span className={g.weightTotal === 100 ? 'text-slate-700' : 'text-amber-700'}>
                {g.weightTotal}
              </span>{' '}
              / 100
            </p>
          )}

          {g.goals.length > 0 && (
            <p className='mt-1 text-xs text-slate-500'>
              {(Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[])
                .map(
                  (c) =>
                    `${GOAL_CATEGORY_LABELS[c].label} ${g.byCategory[c] === null ? '—' : `${g.byCategory[c]}%`} (${GOAL_CATEGORY_LABELS[c].share}%)`,
                )
                .join(' · ')}
            </p>
          )}

          {g.goals.length > 0 && g.weightTotal !== 100 && (
            <p className='mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700'>
              Weights sum to {g.weightTotal}, not 100 — attainment still computes, but ask your
              manager to rebalance.
            </p>
          )}

          {g.goals.length === 0 ? (
            <p className='mt-3 text-sm text-slate-500'>
              No goals yet — they are set by your manager (or HR), not by you. Once set, only YOU
              move the progress.
            </p>
          ) : (
            <div className='mt-3 space-y-3'>
              {g.goals.map((goal) => {
                const value = dragging[goal.id] ?? goal.progress;
                return (
                  <div key={goal.id} className='rounded-lg border border-slate-100 bg-slate-50 p-4'>
                    <div className='flex flex-wrap items-baseline justify-between gap-2'>
                      <div className='min-w-0'>
                        <span className='font-medium text-slate-800'>{goal.title}</span>
                        <span className='ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'>
                          {GOAL_CATEGORY_LABELS[goal.category].label}
                        </span>
                        {goal.positionId && (
                          <Link
                            to={`${HR_HIRING_ROUTE}?position=${goal.positionId}`}
                            title='Progress follows the position — work it (JD, scorecard, candidates) in HR → Hiring'
                            className='ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100'
                          >
                            hiring · open →
                          </Link>
                        )}
                        {isAtRisk(goal, today) && (
                          <span className='ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold uppercase text-red-700'>
                            at risk
                          </span>
                        )}
                        <p className='mt-0.5 text-xs text-slate-500'>
                          {goal.metric && (
                            <>
                              {goal.metric}
                              {goal.target ? ` → ${goal.target}` : ''} ·{' '}
                            </>
                          )}
                          weight {goal.weight} · due {goal.dueOn} ·{' '}
                          <DaysLeftTag dueOn={goal.dueOn} today={today} />
                          {goal.createdByName && <> · set by {goal.createdByName}</>}
                        </p>
                      </div>
                      <span className='text-lg font-semibold tabular-nums text-slate-800'>
                        {value}%
                      </span>
                    </div>
                    {goal.positionId ? (
                      <div className='mt-2 h-2 w-full rounded-full bg-slate-200'>
                        <div
                          className='h-2 rounded-full bg-sky-500'
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    ) : (
                      <input
                        aria-label='Progress'
                        type='range'
                        min={0}
                        max={100}
                        step={5}
                        value={value}
                        disabled={progress.isPending}
                        onChange={(e) =>
                          setDragging((d) => ({ ...d, [goal.id]: Number(e.target.value) }))
                        }
                        onPointerUp={() => {
                          const v = dragging[goal.id];
                          if (v !== undefined && v !== goal.progress)
                            progress.mutate({ id: goal.id, value: v });
                        }}
                        className='mt-2 w-full accent-brand-600'
                      />
                    )}
                  </div>
                );
              })}
              {progress.error && (
                <p className='text-sm text-red-600'>{apiErrorMessage(progress.error)}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Daily work update ──────────────────────────────── */}
      {view === 'mine' && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <div className='flex flex-wrap items-baseline justify-between gap-2'>
            <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
              Today&apos;s work update
            </h2>
            <span className='text-xs text-slate-500'>
              {myUpdates.data?.scoringEnabled
                ? 'Scored against your goals after you submit'
                : 'AI scoring is off — updates store unscored'}
            </span>
          </div>

          {/* Last 14 days — leave, holidays and off days never count as a miss. */}
          <div className='mt-3 flex gap-1'>
            {strip.map((d) => {
              const fillable = d.status === 'missed' && d.date >= lateWindowFloor;
              return (
                <button
                  key={d.date}
                  type='button'
                  disabled={!fillable}
                  onClick={() => setLateFor(d.date)}
                  title={`${d.date} — ${STRIP_LOOK[d.status].label}${
                    d.status === 'missed' && !fillable ? ' (too old to fill in)' : ''
                  }`}
                  className={`h-4 flex-1 rounded-sm ${STRIP_LOOK[d.status].cls}`}
                />
              );
            })}
          </div>
          {myUpdates.data && (
            <p
              className={`mt-1 text-xs ${
                myUpdates.data.missesThisMonth > myUpdates.data.missAllowance
                  ? 'text-red-600'
                  : 'text-slate-500'
              }`}
            >
              {myUpdates.data.missesThisMonth} missed this month (allowance{' '}
              {myUpdates.data.missAllowance}). Click a red day to fill it in late.
            </p>
          )}

          <textarea
            aria-label='Update'
            value={draft}
            onChange={(e) => {
              setNote(e.target.value);
              // Grow with the text, up to a cap (then it scrolls).
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 360)}px`;
            }}
            rows={4}
            placeholder={
              'What did you ship or move today, and for which goal?\n' +
              'What went wrong, and what did you learn? Mistakes are welcome here — this is the learning vault, and an honest hard day scores well.'
            }
            className='mt-3 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
          <p className='mt-1 text-right text-xs tabular-nums text-slate-500'>
            {wordCount(draft)} {wordCount(draft) === 1 ? 'word' : 'words'}
          </p>
          {g.goals.length > 0 && (
            <div className='mt-2 flex flex-wrap items-center gap-1.5'>
              <span className='text-xs text-slate-500'>About:</span>
              {g.goals.map((goal) => (
                <button
                  key={goal.id}
                  type='button'
                  onClick={() =>
                    setTags(
                      tagged.includes(goal.id)
                        ? tagged.filter((x) => x !== goal.id)
                        : [...tagged, goal.id],
                    )
                  }
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    tagged.includes(goal.id)
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {goal.title}
                </button>
              ))}
            </div>
          )}
          <div className='mt-2 flex items-center justify-between gap-3'>
            <p className='text-xs text-slate-500'>
              {todays
                ? 'You already sent today’s update — saving again overwrites it (and rescores it).'
                : 'One entry per day.'}
            </p>
            <button
              type='button'
              disabled={submit.isPending || draft.trim().length < 10}
              onClick={() => submit.mutate(draft.trim())}
              className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
            >
              {submit.isPending ? 'Saving…' : todays ? 'Update today’s entry' : 'Submit update'}
            </button>
          </div>
          {submit.error && (
            <p className='mt-1 text-sm text-red-600'>{apiErrorMessage(submit.error)}</p>
          )}

          {todays && (todays.score !== null || todays.feedback) && (
            <div className='mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm'>
              {todays.score !== null && (
                <span
                  className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreTone(todays.score)}`}
                >
                  {todays.score}/100
                </span>
              )}
              {todays.feedback && <span className='text-slate-600'>{todays.feedback}</span>}
              {todays.kpiHits && todays.kpiHits.length > 0 && (
                <p className='mt-1 text-xs text-slate-500'>Touches: {todays.kpiHits.join(' · ')}</p>
              )}
            </div>
          )}

          {(myUpdates.data?.updates.filter((u) => u.date !== today).length ?? 0) > 0 && (
            <div className='mt-4 space-y-2 border-t border-slate-100 pt-3'>
              {myUpdates
                .data!.updates.filter((u) => u.date !== today)
                .map((u) => (
                  <div key={u.id} className='text-sm'>
                    <span className='font-mono text-xs text-slate-500'>{u.date}</span>
                    {u.score !== null && (
                      <span
                        className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${scoreTone(u.score)}`}
                      >
                        {u.score}
                      </span>
                    )}
                    {u.lateStatus && (
                      <span className='ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700'>
                        late · {u.lateStatus}
                      </span>
                    )}
                    <p className='mt-0.5 text-slate-600'>{u.note}</p>
                    {u.goalIds && u.goalIds.length > 0 && (
                      <p className='text-xs text-slate-500'>
                        About:{' '}
                        {u.goalIds.map((id) => goalTitle.get(id) ?? 'a past goal').join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── RM: late entries waiting ───────────────────────── */}
      {view === 'team' && lateCount > 0 && (
        <div className='rounded-xl border border-amber-200 bg-amber-50/50 p-5'>
          <h2 className='text-xs font-semibold uppercase tracking-wide text-amber-700'>
            Missed updates filled in late — your call
          </h2>
          <p className='mt-1 text-xs text-slate-500'>
            Approve to clear the miss; decline and the day stays missed.
          </p>
          {decideLate.error && (
            <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(decideLate.error)}</p>
          )}
          <div className='mt-3 space-y-3'>
            {lateQueue.data!.map((l) => (
              <div key={l.update.id} className='rounded-lg border border-slate-200 bg-white p-3'>
                <div className='text-sm'>
                  <span className='font-medium text-slate-800'>{l.employee.name}</span>
                  <span className='ml-2 font-mono text-xs text-slate-500'>{l.update.date}</span>
                </div>
                <p className='mt-1 text-sm text-slate-600'>{l.update.note}</p>
                <div className='mt-2 flex gap-2'>
                  <button
                    type='button'
                    disabled={decideLate.isPending}
                    onClick={() => decideLate.mutate({ id: l.update.id, decision: 'approve' })}
                    className='rounded-md bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50'
                  >
                    Approve
                  </button>
                  <button
                    type='button'
                    disabled={decideLate.isPending}
                    onClick={() => decideLate.mutate({ id: l.update.id, decision: 'decline' })}
                    className='rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Own quarter reports (CGP transparency) ─────────── */}
      {view === 'mine' && (myReports.data?.length ?? 0) > 0 && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
            My quarter reports
          </h2>
          <ul className='mt-3 space-y-2'>
            {myReports.data!.map((r) => (
              <QuarterReportCard key={r.id} report={r} />
            ))}
          </ul>
        </div>
      )}

      {/* ── RM: the team's quarter reports ───────────────────── */}
      {view === 'team' && isRm && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Your people — quarter reports
          </h2>
          <QuarterBoard scope='rm' />
        </div>
      )}

      {/* ── RM: the team's goal sheet ──────────────────────── */}
      {view === 'team' && isRm && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Your people — goals
          </h2>
          <div className='overflow-x-auto'>
            <table className='mt-3 min-w-full text-sm'>
              <thead>
                <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                  <th className='py-2 pr-4'>Person</th>
                  <th className='py-2 pr-4'>Goals</th>
                  <th className='py-2 pr-4'>Attainment</th>
                  <th className='py-2 pr-4'>At risk</th>
                  <th className='py-2'></th>
                </tr>
              </thead>
              <tbody>
                {(teamGoals.data ?? []).map((r) => (
                  <tr key={r.employee.id} className='border-t border-slate-100'>
                    <td className='py-2.5 pr-4 font-medium text-slate-700'>
                      <button
                        type='button'
                        onClick={() => openSheet(r.employee.id, r.employee.name)}
                        title={`Last 5 work updates from ${r.employee.name}`}
                        className='hover:text-brand-600 hover:underline'
                      >
                        {r.employee.name}
                      </button>
                    </td>
                    <td className='py-2.5 pr-4 text-slate-600'>
                      {r.goalCount === 0 ? (
                        <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'>
                          none set
                        </span>
                      ) : (
                        r.goalCount
                      )}
                    </td>
                    <td className='py-2.5 pr-4 tabular-nums text-slate-600'>
                      {r.attainment === null ? '—' : `${r.attainment}%`}
                    </td>
                    <td className='py-2.5 pr-4'>
                      {r.atRisk > 0 ? (
                        <span className='rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'>
                          {r.atRisk}
                        </span>
                      ) : (
                        <span className='text-xs text-slate-500'>0</span>
                      )}
                    </td>
                    <td className='space-x-3 whitespace-nowrap py-2.5 text-right'>
                      {r.goalCount > 0 && (
                        <button
                          type='button'
                          onClick={() => setManaging({ id: r.employee.id, name: r.employee.name })}
                          className='text-xs text-slate-500 hover:text-brand-600 hover:underline'
                        >
                          Edit goals
                        </button>
                      )}
                      <button
                        type='button'
                        onClick={() => setGoalFor(r.employee)}
                        className='text-xs text-brand-600 hover:underline'
                      >
                        Add goal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RM: the team's update sheet (read-only) ────────── */}
      {view === 'team' && isRm && (teamUpdates.data?.length ?? 0) > 0 && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Your people — updates this week
          </h2>
          <TeamUpdatesGrid
            rows={teamUpdates.data ?? []}
            onPerson={(p) => openSheet(p.id, p.name)}
            onDay={(person, update) => setDayOpen({ person, update })}
          />
          <details className='mt-4'>
            <summary className='cursor-pointer text-xs text-slate-500 hover:text-slate-700'>
              Show the notes as a list
            </summary>
            <div className='mt-3 space-y-4'>
              {(teamUpdates.data ?? [])
                .filter((r) => r.updates.length > 0 || r.missesThisMonth > 0)
                .map((r) => (
                  <div key={r.employee.id}>
                    <button
                      type='button'
                      onClick={() => openSheet(r.employee.id, r.employee.name)}
                      title={`Last 5 work updates from ${r.employee.name}`}
                      className='font-medium text-slate-700 hover:text-brand-600 hover:underline'
                    >
                      {r.employee.name}
                    </button>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        r.overAllowance ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {r.missesThisMonth} missed this month
                      {r.overAllowance ? ' — over allowance' : ''}
                    </span>
                    <div className='mt-1 space-y-1.5'>
                      {r.updates.map((u) => (
                        <div key={u.id} className='text-sm'>
                          <span className='font-mono text-xs text-slate-500'>{u.date}</span>
                          {u.score !== null && (
                            <span
                              className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${scoreTone(u.score)}`}
                            >
                              {u.score}
                            </span>
                          )}
                          <button
                            type='button'
                            onClick={() =>
                              react({ id: r.employee.id, name: r.employee.name }, u.date)
                            }
                            className='ml-2 text-xs text-brand-600 hover:underline'
                          >
                            React
                          </button>
                          <p className='mt-0.5 text-slate-600'>{u.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </details>
        </div>
      )}

      {/* ── One day from the team grid ──────────────────────── */}
      {dayOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'
          onClick={() => setDayOpen(null)}
        >
          <div
            className='max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-slate-800'>{dayOpen.person.name}</h2>
                <p className='text-xs text-slate-500'>
                  {new Date(`${dayOpen.update.date}T00:00:00`).toLocaleDateString([], {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  {dayOpen.update.lateStatus && ' · filled in late'}
                </p>
              </div>
              <button
                type='button'
                onClick={() => setDayOpen(null)}
                className='text-sm text-slate-500 hover:text-slate-600'
              >
                ✕
              </button>
            </div>
            {dayOpen.update.score !== null && (
              <span
                className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${scoreTone(dayOpen.update.score)}`}
              >
                Score {dayOpen.update.score}
              </span>
            )}
            <p className='mt-3 whitespace-pre-wrap text-sm text-slate-700'>{dayOpen.update.note}</p>
            {dayOpen.update.feedback && (
              <p className='mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600'>
                {dayOpen.update.feedback}
              </p>
            )}
            {(dayOpen.update.kpiHits?.length ?? 0) > 0 && (
              <p className='mt-2 text-xs text-slate-500'>
                Touches: {dayOpen.update.kpiHits!.join(', ')}
              </p>
            )}
            <div className='mt-4 flex justify-end'>
              <button
                type='button'
                onClick={() => {
                  react(dayOpen.person, dayOpen.update.date);
                  setDayOpen(null);
                }}
                className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-brand-600 hover:bg-slate-50'
              >
                React to this
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Last-5-updates peek ────────────────────────────── */}
      {peek && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'
          onClick={() => setPeek(null)}
        >
          <div
            className='max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-slate-800'>{peek.name}</h2>
                <p className='text-xs text-slate-500'>Last 5 work updates · past 30 days</p>
              </div>
              <button
                type='button'
                onClick={() => setPeek(null)}
                className='rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50'
              >
                Close
              </button>
            </div>

            <div className='mt-4'>
              {peekUpdates.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
              {peekUpdates.error && (
                <p className='text-sm text-red-600'>{apiErrorMessage(peekUpdates.error)}</p>
              )}
              {peekUpdates.data && peekUpdates.data.length === 0 && (
                <p className='text-sm text-slate-500'>
                  Nothing on the sheet in 30 days — either they haven&apos;t started writing, or
                  nobody told them the sheet exists. Both are worth five minutes.
                </p>
              )}
              {peekUpdates.data && peekUpdates.data.length > 0 && (
                <ul className='space-y-3'>
                  {peekUpdates.data.slice(0, 5).map((u) => (
                    <li key={u.id} className='border-l-2 border-slate-200 pl-3'>
                      <div className='flex items-center gap-2'>
                        <span className='font-mono text-xs text-slate-500'>{u.date}</span>
                        {u.score !== null ? (
                          <span
                            className={`rounded-full px-1.5 py-px text-xs font-semibold ${scoreTone(u.score)}`}
                          >
                            {u.score}
                          </span>
                        ) : (
                          <span className='rounded-full bg-slate-100 px-1.5 py-px text-xs text-slate-500'>
                            unscored
                          </span>
                        )}
                      </div>
                      <button
                        type='button'
                        onClick={() => {
                          react(peek, u.date);
                          setPeek(null);
                        }}
                        className='text-xs text-brand-600 hover:underline'
                      >
                        React
                      </button>
                      <p className='mt-0.5 text-sm text-slate-600'>{u.note}</p>
                      {u.feedback && <p className='mt-0.5 text-xs text-slate-500'>{u.feedback}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {lateFor && (
        <LateUpdateModal
          date={lateFor}
          goals={g.goals}
          selfGoverned={me.data?.selfGoverned ?? false}
          onClose={() => setLateFor(null)}
        />
      )}
      {managing && <ManageGoalsModal person={managing} onClose={() => setManaging(null)} />}
      {noteDraft && <FeedbackModal draft={noteDraft} onClose={() => setNoteDraft(null)} />}

      {/* ── Add-goal modal ─────────────────────────────────── */}
      {goalFor && (
        <ModalShell onClose={() => setGoalFor(null)}>
          <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-lg'>
            <h2 className='text-lg font-semibold text-slate-800'>Goal for {goalFor.name}</h2>
            <p className='mt-1 text-xs text-slate-500'>
              Weights should sum to 100 within the quarter; the score weighs categories 50 / 25 /
              25. Due date defaults to the cycle end.
            </p>
            <div className='mt-4 space-y-3'>
              <input
                aria-label='Goal title (what done looks like)'
                value={goalDraft.title}
                onChange={(e) => setGoalDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder='Goal title (what done looks like)'
                className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
              />
              <div className='grid grid-cols-2 gap-3'>
                <input
                  aria-label='Metric (optional)'
                  value={goalDraft.metric ?? ''}
                  onChange={(e) =>
                    setGoalDraft((d) => ({ ...d, metric: e.target.value || undefined }))
                  }
                  placeholder='Metric (optional)'
                  className='rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                />
                <input
                  aria-label='Target (optional)'
                  value={goalDraft.target ?? ''}
                  onChange={(e) =>
                    setGoalDraft((d) => ({ ...d, target: e.target.value || undefined }))
                  }
                  placeholder='Target (optional)'
                  className='rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                />
              </div>
              <label className='block text-xs text-slate-500'>
                Category (share of the quarter score)
                <select
                  value={goalDraft.category ?? 'fundamental'}
                  onChange={(e) =>
                    setGoalDraft((d) => ({ ...d, category: e.target.value as GoalCategory }))
                  }
                  className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                >
                  {(Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {GOAL_CATEGORY_LABELS[c].label} — {GOAL_CATEGORY_LABELS[c].share}%
                    </option>
                  ))}
                </select>
              </label>
              <div className='grid grid-cols-2 gap-3'>
                <label className='text-xs text-slate-500'>
                  Weight
                  <input
                    type='number'
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={goalDraft.weight}
                    onChange={(e) =>
                      setGoalDraft((d) => ({ ...d, weight: Number(e.target.value) }))
                    }
                    className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                  />
                  {(() => {
                    const before = goalForIsMe ? g.weightTotal : goalForGoals.data?.weightTotal;
                    if (before === undefined) return null;
                    const total = Math.round((before + (goalDraft.weight || 0)) * 10) / 10;
                    return (
                      <span
                        className={`mt-1 block ${total === 100 ? 'text-green-700' : total > 100 ? 'text-red-600' : 'text-amber-700'}`}
                      >
                        Total weight with this goal: {total} / 100
                      </span>
                    );
                  })()}
                </label>
                <label className='text-xs text-slate-500'>
                  Due on (optional)
                  <input
                    type='date'
                    value={goalDraft.dueOn ?? ''}
                    onChange={(e) =>
                      setGoalDraft((d) => ({ ...d, dueOn: e.target.value || undefined }))
                    }
                    className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                  />
                </label>
              </div>
            </div>
            {createGoal.error && (
              <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(createGoal.error)}</p>
            )}
            <div className='mt-4 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => {
                  setGoalFor(null);
                  setGoalDraft(EMPTY_GOAL);
                }}
                className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                Cancel
              </button>
              <button
                type='button'
                disabled={createGoal.isPending || goalDraft.title.trim().length < 3}
                onClick={() =>
                  createGoal.mutate({
                    ...goalDraft,
                    title: goalDraft.title.trim(),
                    employeeId: goalFor.id,
                  })
                }
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
              >
                {createGoal.isPending ? 'Adding…' : 'Add goal'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export default MyPerformancePage;

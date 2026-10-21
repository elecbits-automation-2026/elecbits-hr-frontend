import { useQuery } from '@tanstack/react-query';

import type { AttendanceDay, Level } from '@app-types/api.types';
import { leaveTypeLabel } from '@constants/Common/leaves/leave.constants';
import PromotionHistory from '@components/Employee/Growth/PromotionHistory.component';
import RoadmapNotes from '@components/Employee/Growth/RoadmapNotes.component';
import PersonAssets from '@components/Ops/PersonAssets.component';
import { PersonPips } from '@components/Common/Pip/PipLists.component';
import { BAND_LOOK } from '@constants/Common/quarter.constants';
import { careerApi } from '@services/api/career.api';
import { feedbackApi } from '@services/api/feedback.api';
import { quarterReportsApi } from '@services/api/quarterReports.api';
import { leavesApi } from '@services/api/leaves.api';
import { performanceApi } from '@services/api/performance.api';
import { apiErrorMessage } from '@utils/apiError';

const todayStr = () => new Date().toLocaleDateString('en-CA');
const DAY_MS = 86_400_000;

const tenureOf = (doj: string | null): string => {
  if (!doj) return '—';
  const months = Math.max(0, Math.floor((Date.now() - Date.parse(doj)) / DAY_MS / 30.44));
  if (months < 1) return 'under a month';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y}y ${m}m` : `${m}m`;
};

const niceDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

const initialsOf = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

const scoreTone = (score: number): string =>
  score >= 70 ? 'bg-green-50 text-green-700' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';

const barTone = (p: number): string =>
  p >= 70 ? 'bg-green-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400';

const pctTone = (p: number): string =>
  p >= 90 ? 'text-green-600' : p >= 75 ? 'text-amber-600' : 'text-red-600';

/**
 * The minimum a caller must know about somebody to open their sheet — both
 * the My Team roster row and the HR People row satisfy it.
 */
export interface SheetPerson {
  id: string;
  name: string;
  employeeCode: string;
  designation: string | null;
  department: string | null;
  level: Level;
  status: 'invited' | 'active' | 'exiting' | 'inactive';
  dateOfJoining: string | null;
}

const STATUS_CHIP: Record<SheetPerson['status'], string> = {
  invited: 'bg-violet-50 text-violet-700',
  active: 'bg-green-50 text-green-700',
  exiting: 'bg-red-50 text-red-700',
  inactive: 'bg-slate-100 text-slate-500',
};

/** One framed section of the sheet. */
const Card = ({
  title,
  right,
  className = '',
  children,
}: {
  title: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
    <div className='flex flex-wrap items-baseline justify-between gap-2'>
      <h3 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{title}</h3>
      {right}
    </div>
    <div className='mt-3'>{children}</div>
  </section>
);

/**
 * The RM's read-only 360° of one report (adopted from the old HR tool's
 * PersonSheet): identity, this quarter's goals, the last updates they wrote,
 * attendance this month, leave balances and growth state — and deliberately
 * NO pay. Menstrual leave never reaches this view (the backend strips it),
 * and nothing on this sheet writes to their record.
 */
const PersonSheet = ({
  member,
  days,
  onClose,
  onNote,
  canStartPip = false,
}: {
  member: SheetPerson;
  /** This month's classified days (team or org attendance query; may be empty). */
  days: AttendanceDay[];
  onClose: () => void;
  /** Omitted where the feedback modal isn't wired — the button hides. */
  onNote?: (m: SheetPerson) => void;
  /** My team (the RM): may open a PIP. HR approves it elsewhere. */
  canStartPip?: boolean;
}) => {
  const today = todayStr();

  const goals = useQuery({
    queryKey: ['team-member-goals', member.id],
    queryFn: () => performanceApi.teamMemberGoals(member.id),
  });
  const balances = useQuery({
    queryKey: ['team-member-balances', member.id],
    queryFn: () => leavesApi.teamBalances(member.id),
  });
  const updates = useQuery({
    queryKey: ['team-member-updates', member.id],
    queryFn: () => performanceApi.teamMemberUpdates(member.id, 14),
  });
  const careerTeam = useQuery({ queryKey: ['career-team'], queryFn: careerApi.team });
  const myCareer = useQuery({ queryKey: ['my-career'], queryFn: careerApi.mine });
  const notes = useQuery({
    queryKey: ['person-notes', member.id],
    queryFn: () => feedbackApi.about(member.id),
  });
  const quarterReports = useQuery({
    queryKey: ['person-quarter-reports', member.id],
    queryFn: () => quarterReportsApi.forPerson(member.id),
  });
  const latestReport = quarterReports.data?.[0] ?? null;
  const personCareer = useQuery({
    queryKey: ['person-career', member.id],
    queryFn: () => careerApi.person(member.id),
  });

  // ── Attendance this month, up to today. Credit: full day 1, half day 0.5.
  const past = days.filter((d) => d.date <= today);
  const counts = {
    present: past.filter((d) => d.status === 'present').length,
    wfh: past.filter((d) => d.status === 'wfh').length,
    half: past.filter((d) => d.status === 'half_day' || d.status === 'half_leave').length,
    leave: past.filter((d) => d.status === 'leave').length,
    absent: past.filter((d) => d.status === 'absent').length,
  };
  const working = counts.present + counts.wfh + counts.half + counts.leave + counts.absent;
  const attPct = working
    ? Math.round(((counts.present + counts.wfh + counts.half * 0.5) / working) * 100)
    : null;

  const theirUpdates = (updates.data ?? []).slice(0, 5);

  const careerRow = (careerTeam.data ?? []).find((r) => r.employee.id === member.id) ?? null;
  const ladder = myCareer.data?.ladder ?? [];
  const band = ladder.find((b) => b.code === member.level) ?? null;
  const nextBand = band?.next ? ladder.find((b) => b.code === band.next) : null;

  const g = goals.data;
  const awards = careerRow?.recognitions ?? 0;
  const openTrack = personCareer.data?.track ?? careerRow?.track ?? null;
  const dueConversation = careerRow !== null && awards === 0 && !openTrack;

  const stats: Array<{ n: string; label: string; tone?: string }> = [
    {
      n: g?.attainment === null || g?.attainment === undefined ? '—' : `${g.attainment}%`,
      label: 'goal attainment',
      tone: g?.attainment != null ? pctTone(g.attainment) : undefined,
    },
    {
      n: attPct === null ? '—' : `${attPct}%`,
      label: 'attendance this month',
      tone: attPct !== null ? pctTone(attPct) : undefined,
    },
    { n: `${theirUpdates.length}`, label: 'updates, last 14 days' },
    // career/team is chain-scoped — on the HR People page the row may be
    // missing for someone outside the viewer's chain; '—' beats a false 0.
    {
      n: careerRow ? `${awards}` : '—',
      label: awards === 1 ? 'award on the board' : 'awards on the board',
    },
  ];

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'
      onClick={onClose}
    >
      <div
        className='max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-slate-50 shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── header ── */}
        <div className='sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4'>
          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white'>
              {initialsOf(member.name)}
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <h2 className='text-lg font-semibold text-slate-800'>{member.name}</h2>
                <span className='rounded-full bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-700'>
                  {member.level}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CHIP[member.status]}`}
                >
                  {member.status}
                </span>
              </div>
              <p className='mt-0.5 truncate text-sm text-slate-500'>
                {member.designation ?? 'No designation'}
                {member.department && <> · {member.department}</>}
                <span className='ml-2 font-mono text-xs text-slate-400'>
                  {member.employeeCode}
                </span>
              </p>
              {member.dateOfJoining && (
                <p className='mt-0.5 text-xs text-slate-400'>
                  joined {niceDate(member.dateOfJoining)} · {tenureOf(member.dateOfJoining)} with us
                </p>
              )}
            </div>
            <button
              type='button'
              onClick={onClose}
              aria-label='Close'
              className='rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            >
              <svg width='18' height='18' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
                <path d='M5 5l10 10M15 5L5 15' />
              </svg>
            </button>
          </div>
        </div>

        <div className='space-y-4 p-6'>
          {/* ── stat tiles ── */}
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            {stats.map((s) => (
              <div key={s.label} className='rounded-xl border border-slate-200 bg-white px-4 py-3'>
                <p className={`text-xl font-semibold tabular-nums ${s.tone ?? 'text-slate-800'}`}>{s.n}</p>
                <p className='mt-0.5 text-[11px] leading-tight text-slate-400'>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── goals ── */}
          <Card
            title={g ? `Goals · ${g.cycle.name}` : 'Goals'}
            right={
              g && g.atRisk > 0 ? (
                <span className='rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'>
                  {g.atRisk} at risk
                </span>
              ) : undefined
            }
          >
            {goals.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
            {goals.error && <p className='text-sm text-red-600'>{apiErrorMessage(goals.error)}</p>}
            {g && g.goals.length === 0 && (
              <p className='text-sm text-slate-500'>
                No goals written for this quarter — a quarter with nothing written can&apos;t be
                reviewed at the end of it. Set them from <b>My performance</b>.
              </p>
            )}
            {g && g.goals.length > 0 && (
              <div className='space-y-2.5'>
                {g.weightTotal !== 100 && (
                  <p className='rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700'>
                    Weights sum to {g.weightTotal}, not 100.
                  </p>
                )}
                {g.goals.map((goal) => (
                  <div key={goal.id} className='rounded-lg bg-slate-50 px-3.5 py-2.5'>
                    <div className='flex flex-wrap items-baseline justify-between gap-2 text-sm'>
                      <span className='font-medium text-slate-700'>{goal.title}</span>
                      <span className='font-mono text-[11px] text-slate-400'>
                        w{goal.weight} · due {shortDate(goal.dueOn)}
                      </span>
                    </div>
                    {goal.metric && (
                      <p className='mt-0.5 text-xs text-slate-400'>
                        {goal.metric}
                        {goal.target ? ` → ${goal.target}` : ''}
                      </p>
                    )}
                    <div className='mt-2 flex items-center gap-2'>
                      <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200'>
                        <div
                          className={`h-full rounded-full ${barTone(goal.progress)}`}
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <span className='w-9 text-right font-mono text-xs font-semibold tabular-nums text-slate-600'>
                        {goal.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className='grid gap-4 lg:grid-cols-2'>
            {/* ── last updates ── */}
            <Card title='Last work updates'>
              {theirUpdates.length === 0 ? (
                <p className='text-sm text-slate-500'>
                  Nothing on the sheet in two weeks — either they haven&apos;t started writing, or
                  nobody told them the sheet exists. Both are worth five minutes.
                </p>
              ) : (
                <ul className='space-y-3'>
                  {theirUpdates.map((u) => (
                    <li key={u.id} className='border-l-2 border-slate-200 pl-3'>
                      <div className='flex items-center gap-2'>
                        <span className='font-mono text-[11px] text-slate-400'>{shortDate(u.date)}</span>
                        {u.score !== null ? (
                          <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${scoreTone(u.score)}`}>
                            {u.score}
                          </span>
                        ) : (
                          <span className='rounded-full bg-slate-100 px-1.5 py-px text-[10px] text-slate-500'>
                            unscored
                          </span>
                        )}
                      </div>
                      <p className='mt-0.5 line-clamp-2 text-sm text-slate-600'>{u.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className='space-y-4'>
              {/* ── attendance ── */}
              <Card
                title='Attendance this month'
                right={
                  working > 0 ? (
                    <span className='text-xs text-slate-400'>{working} working days so far</span>
                  ) : undefined
                }
              >
                {working === 0 ? (
                  <p className='text-sm text-slate-500'>No working days recorded yet.</p>
                ) : (
                  <>
                    {/* One stacked bar — every state owns its app-wide hue. */}
                    <div className='flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100'>
                      {counts.present > 0 && <div className='bg-green-500' style={{ width: `${(counts.present / working) * 100}%` }} />}
                      {counts.wfh > 0 && <div className='bg-blue-400' style={{ width: `${(counts.wfh / working) * 100}%` }} />}
                      {counts.half > 0 && <div className='bg-orange-400' style={{ width: `${(counts.half / working) * 100}%` }} />}
                      {counts.leave > 0 && <div className='bg-blue-600' style={{ width: `${(counts.leave / working) * 100}%` }} />}
                      {counts.absent > 0 && <div className='bg-red-500' style={{ width: `${(counts.absent / working) * 100}%` }} />}
                    </div>
                    <div className='mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500'>
                      {counts.present > 0 && <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-green-500' />present {counts.present}</span>}
                      {counts.wfh > 0 && <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-blue-400' />remote {counts.wfh}</span>}
                      {counts.half > 0 && <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-orange-400' />half-day {counts.half}</span>}
                      {counts.leave > 0 && <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-blue-600' />leave {counts.leave}</span>}
                      {counts.absent > 0 && <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-red-500' />absent {counts.absent}</span>}
                    </div>
                  </>
                )}
              </Card>

              {/* ── leave balances ── */}
              <Card title='Leave balances'>
                {balances.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
                {balances.error && (
                  <p className='text-sm text-red-600'>{apiErrorMessage(balances.error)}</p>
                )}
                {balances.data && (
                  <div className='space-y-2'>
                    {balances.data.map((b) => {
                      const total = b.allocated === null ? null : Math.min(b.opening + b.allocated, 30);
                      const usedPct = total ? Math.min(100, (b.used / total) * 100) : 0;
                      return (
                        <div key={b.type}>
                          <div className='flex items-baseline justify-between text-sm'>
                            <span className='text-slate-600'>{leaveTypeLabel(b.type)}</span>
                            <span className='font-mono text-xs tabular-nums text-slate-500'>
                              {b.remaining === null
                                ? `${b.used} used`
                                : `${b.remaining} left · ${b.used}/${total}`}
                            </span>
                          </div>
                          {total !== null && (
                            <div className='mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100'>
                              <div
                                className={`h-full rounded-full ${usedPct >= 100 ? 'bg-red-400' : 'bg-brand-500'}`}
                                style={{ width: `${usedPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* ── last quarter + notes history + PIP ── */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <Card
              title={latestReport ? `Quarter report · ${latestReport.cycleName}` : 'Quarter report'}
            >
              {!latestReport ? (
                <p className='text-sm text-slate-400'>No closed quarter yet.</p>
              ) : (
                <div className='space-y-1.5 text-sm'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-2xl font-semibold tabular-nums text-slate-800'>
                      {latestReport.finalScore ?? '—'}
                    </span>
                    {latestReport.finalBand && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND_LOOK[latestReport.finalBand].cls}`}
                      >
                        {BAND_LOOK[latestReport.finalBand].label}
                      </span>
                    )}
                  </div>
                  <p className='text-xs text-slate-500'>
                    computed {latestReport.computedScore ?? '—'}
                    {latestReport.adjustedByName && ` · final set by ${latestReport.adjustedByName}`}
                    {' · '}updates {latestReport.updates.submitted}/{latestReport.updates.expected}
                    {' · '}attendance{' '}
                    {latestReport.attendance.attendancePct === null
                      ? '—'
                      : `${latestReport.attendance.attendancePct}%`}
                  </p>
                  {(quarterReports.data?.length ?? 0) > 1 && (
                    <p className='text-xs text-slate-400'>
                      Earlier:{' '}
                      {quarterReports
                        .data!.slice(1, 4)
                        .map((r) => `${r.cycleName} ${r.finalScore ?? '—'}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </Card>
            <Card title='PIP'>
              <PersonPips
                employeeId={member.id}
                canStart={canStartPip}
                pipCandidate={latestReport?.pipCandidate ? latestReport.cycleName : null}
              />
            </Card>
          </div>

          <Card title='Notes history'>
            {notes.error ? (
              <p className='text-sm text-slate-400'>{apiErrorMessage(notes.error)}</p>
            ) : (notes.data?.length ?? 0) === 0 ? (
              <p className='text-sm text-slate-400'>No notes sent to {member.name} yet.</p>
            ) : (
              <ul className='space-y-2'>
                {notes.data!.slice(0, 8).map((n) => (
                  <li key={n.id} className='text-sm'>
                    <span
                      className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        n.type === 'appreciation'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {n.type}
                    </span>
                    <span className='text-xs text-slate-500'>
                      {n.createdAt.slice(0, 10)} · from {n.author.name}
                    </span>
                    {n.body ? (
                      <p className='mt-0.5 text-slate-700'>{n.body}</p>
                    ) : (
                      <p className='mt-0.5 text-xs italic text-slate-400'>
                        Between {n.author.name} and {member.name}.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── growth ── */}
          <Card
            title='Growth'
            right={
              dueConversation ? (
                <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700'>
                  due a conversation
                </span>
              ) : undefined
            }
          >
            <div className='flex flex-wrap items-center gap-2 text-sm'>
              <span className='rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700'>
                {band ? `${band.code} · ${band.name}` : member.level}
              </span>
              {nextBand && (
                <span className='text-xs text-slate-400'>
                  next up: {nextBand.code} · {nextBand.name}
                </span>
              )}
              {openTrack && (
                <span className='rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700'>
                  conversation open → {openTrack.targetBand}
                </span>
              )}
              {careerRow && (
                <span className='rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700'>
                  {awards} award{awards === 1 ? '' : 's'}
                  {careerRow.lastRecognizedAt && ` · last ${shortDate(careerRow.lastRecognizedAt.slice(0, 10))}`}
                </span>
              )}
            </div>
            {dueConversation && (
              <p className='mt-2 text-xs text-slate-500'>
                Nothing recognized and no roadmap open — that combination is how somebody good
                starts looking elsewhere without saying anything first.
              </p>
            )}
            {personCareer.data && (
              <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                <div>
                  <h4 className='text-xs font-medium text-slate-500'>Band history</h4>
                  <div className='mt-2'>
                    <PromotionHistory history={personCareer.data.history} />
                  </div>
                </div>
                {personCareer.data.track && (
                  <div>
                    <h4 className='text-xs font-medium text-slate-500'>Roadmap notes</h4>
                    <div className='mt-2'>
                      <RoadmapNotes
                        notes={personCareer.data.notes}
                        trackId={personCareer.data.track.id}
                        employeeId={member.id}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <PersonAssets employeeId={member.id} />

          {/* ── footer ── */}
          <div className='flex flex-wrap items-center justify-between gap-3 pb-1'>
            <p className='max-w-md text-xs text-slate-400'>
              No pay on this sheet, and nothing here changes their record — roadmap notes are the
              one thing you can add. None of it replaces asking them.
            </p>
            {onNote && (
              <button
                type='button'
                onClick={() => onNote(member)}
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
              >
                Send a note
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonSheet;

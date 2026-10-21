import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { attendanceApi } from '@services/api/attendance.api';
import { leavesApi } from '@services/api/leaves.api';
import { performanceApi } from '@services/api/performance.api';
import { computeTeamInsights, type Insight } from '@insights';
import FeedbackModal, { type FeedbackDraft } from './FeedbackModal.component';
import TeamLoadStrip from './TeamLoadStrip.component';
import TeamTrendChart from './TeamTrendChart.component';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
const todayStr = () => new Date().toLocaleDateString('en-CA');

const BORDER: Record<Insight['severity'], string> = {
  alert: 'border-red-400',
  warn: 'border-amber-400',
  info: 'border-slate-200',
};

/**
 * The RM's exception-first team panel (user decision): only deviations are
 * listed — a healthy team reads as one quiet "all clear" line — plus two
 * small charts that make the gaps visible. Insight computation lives in the
 * pluggable registry (src/insights); future domains (KPI tracking, worksheet
 * compliance) add sources there without touching this component.
 */
const TeamInsights = () => {
  const month = currentMonth();
  const today = todayStr();
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);

  /** The system DRAFTS from the insight's evidence; the human edits + sends. */
  const draftFromInsight = (i: Insight) => {
    if (!i.person) return;
    setDraft({
      recipient: i.person,
      type: 'concern',
      body: `Hi ${i.person.name.split(' ')[0]}, regarding your attendance this month: ${i.detail}. Let's talk if something's getting in the way.`,
      evidence: `${i.title} — ${i.detail} · ${month}`,
    });
  };

  const draftAppreciation = (person: { id: string; name: string }, presentDays: number) => {
    setDraft({
      recipient: person,
      type: 'appreciation',
      body: `Hi ${person.name.split(' ')[0]}, just a note to say your consistency this month hasn't gone unnoticed — ${presentDays} days present and on top of things. Thank you!`,
      evidence: `Month so far: ${presentDays} present days · ${month}`,
    });
  };

  // Same query keys as the Team pages — the cache is shared both ways.
  const team = useQuery({
    queryKey: ['team-attendance', month],
    queryFn: () => attendanceApi.team(month),
  });
  const teamLeaves = useQuery({ queryKey: ['team-leaves'], queryFn: leavesApi.listTeam });
  const teamWfh = useQuery({ queryKey: ['team-wfh'], queryFn: attendanceApi.teamWfh });
  // Same keys as the performance page — the cache is shared both ways.
  const teamGoals = useQuery({ queryKey: ['team-goals'], queryFn: performanceApi.teamGoals });
  const teamUpdates = useQuery({
    queryKey: ['team-work-updates'],
    queryFn: () => performanceApi.teamUpdates(7),
  });

  if (!team.data || !teamLeaves.data || !teamWfh.data) return null;
  if (team.data.length === 0) return null;

  const insights = computeTeamInsights({
    months: team.data,
    leaves: teamLeaves.data,
    wfh: teamWfh.data,
    goals: teamGoals.data ?? [],
    updates: teamUpdates.data ?? [],
    today,
  });

  return (
    <section className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex items-baseline justify-between'>
        <h2 className='text-sm font-semibold text-slate-700'>Team insights</h2>
        <span className='text-xs text-slate-400'>{team.data.length} reports · this month</span>
      </div>

      <div className='mt-4 grid gap-6 lg:grid-cols-2'>
        <div>
          <h3 className='mb-2 text-xs font-medium uppercase tracking-wide text-slate-400'>
            Needs attention
          </h3>
          {insights.length === 0 ? (
            <p className='text-sm text-slate-400'>
              All clear — no late streaks, absences or waiting requests.
            </p>
          ) : (
            <ul className='space-y-2'>
              {insights.map((i) => (
                <li
                  key={i.id}
                  className={`rounded-md border-l-2 ${BORDER[i.severity]} bg-slate-50 px-3 py-2 text-sm`}
                >
                  <div className='text-slate-800'>
                    {i.person && <b>{i.person.name}</b>}
                    {i.person ? ' — ' : ''}
                    {i.title}
                  </div>
                  <div className='mt-0.5 flex items-baseline justify-between gap-3 text-xs text-slate-500'>
                    <span>{i.detail}</span>
                    <span className='flex shrink-0 gap-2'>
                      {i.person && (
                        <button
                          type='button'
                          onClick={() => draftFromInsight(i)}
                          className='text-brand-600 hover:underline'
                          title='Drafts a note from this evidence — you review and send'
                        >
                          draft note
                        </button>
                      )}
                      {i.to && (
                        <Link to={i.to} className='text-brand-600 hover:underline'>
                          open →
                        </Link>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='space-y-5'>
          <div>
            <h3 className='mb-2 text-xs font-medium uppercase tracking-wide text-slate-400'>
              Weekly gaps (late / absent)
            </h3>
            <TeamTrendChart months={team.data} today={today} />
          </div>
          <div>
            <h3 className='mb-2 text-xs font-medium uppercase tracking-wide text-slate-400'>
              Month so far, per person
            </h3>
            <TeamLoadStrip
              months={team.data}
              today={today}
              insights={insights}
              onAppreciate={draftAppreciation}
            />
          </div>
          {/* ONE legend for both charts — every state owns exactly one hue. */}
          <div className='flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-400'>
            <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-green-500' />present</span>
            <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-blue-400' />leave/remote</span>
            <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-yellow-400' />late check-in</span>
            <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-orange-500' />half-day</span>
            <span><span className='mr-1 inline-block h-2 w-2 rounded-sm bg-red-500' />absent</span>
          </div>
        </div>
      </div>

      {draft && <FeedbackModal draft={draft} onClose={() => setDraft(null)} />}
    </section>
  );
};

export default TeamInsights;

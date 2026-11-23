import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { TeamMember } from '@app-types/api.types';
import { DAILY_KPI_ROUTE } from '@constants/Common/navigation/routes.constants';

import type { Ranked } from './talkNext';

/** Where the flags come from, and what an empty card does (and doesn't) mean. */
const KpiCaveat = () => (
  <p className='mt-2 text-xs text-slate-500'>
    The flags here come from the Daily KPI page. It is worked out from attendance, work updates and
    goals, so an empty list means nothing was flagged — not that nobody was checked.{' '}
    <Link to={DAILY_KPI_ROUTE} className='font-medium text-brand-600 hover:underline'>
      Open Daily KPI →
    </Link>
  </p>
);

/** The ranked card on My team — the top five, with "show all". */
const TalkNext = ({ ranked, onOpen }: { ranked: Ranked[]; onOpen: (m: TeamMember) => void }) => {
  const [all, setAll] = useState(false);
  if (ranked.length === 0) {
    return (
      <div className='rounded-xl border border-emerald-200 bg-emerald-50 p-4'>
        <p className='text-sm text-emerald-800'>
          ✓ Nobody stands out — no quiet growth, no flags, no overdue trainings.
        </p>
        <KpiCaveat />
      </div>
    );
  }
  const shown = all ? ranked : ranked.slice(0, 5);
  return (
    <section className='rounded-xl border border-slate-200 bg-white p-4'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='text-sm font-semibold text-slate-800'>Who to talk to next</h2>
        <span className='text-xs text-slate-500'>
          From awards, roadmaps, goals, today&rsquo;s Daily KPI and trainings
        </span>
      </div>
      <ol className='mt-2 divide-y divide-slate-100'>
        {shown.map((r, i) => (
          <li key={r.member.id}>
            <button
              type='button'
              onClick={() => onOpen(r.member)}
              className='flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-left hover:bg-slate-50'
            >
              <span className='w-5 text-sm font-semibold tabular-nums text-slate-500'>{i + 1}</span>
              <span className='font-medium text-slate-800'>{r.member.name}</span>
              <span className='text-xs text-slate-500'>
                goals {r.attainment === null ? '—' : `${r.attainment}%`} · {r.recognitions} award
                {r.recognitions === 1 ? '' : 's'} · {r.openTrainings} open training
                {r.openTrainings === 1 ? '' : 's'}
                {r.hasTrack && ' · roadmap open'}
              </span>
              <span className='w-full pl-8 text-xs text-slate-600'>{r.reasons.join(' · ')}</span>
            </button>
          </li>
        ))}
      </ol>
      {ranked.length > 5 && (
        <button
          type='button'
          onClick={() => setAll(!all)}
          className='mt-1 text-xs text-brand-600 hover:underline'
        >
          {all ? 'Show the top five' : `Show all ${ranked.length}`}
        </button>
      )}
      <KpiCaveat />
    </section>
  );
};

export default TalkNext;

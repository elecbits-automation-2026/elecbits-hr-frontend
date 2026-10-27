import { useState } from 'react';

import type { Application } from '@app-types/api.types';
import { ROUND_LABEL } from '@constants/Common/hiring.constants';

/**
 * The scorecard summary, like the Excel's first sheet: who the candidate is,
 * each round's score out of 100, its weight and weighted score, and the total
 * out of 100. Click a round to see every attribute's score and evidence.
 */
const ScorecardSummary = ({ app }: { app: Application }) => {
  const [open, setOpen] = useState<string | null>(null);
  const scored = app.rounds.filter((r) => r.score).length;

  return (
    <div className='space-y-2 text-xs'>
      <p className='text-slate-500'>
        {app.candidateEducation ?? 'Education not recorded'} ·{' '}
        {app.candidateExperienceYears === null
          ? 'experience not recorded'
          : `${app.candidateExperienceYears} yrs experience`}
      </p>
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[420px] text-left'>
          <thead className='text-[10px] uppercase tracking-wide text-slate-400'>
            <tr>
              <th className='py-1 pr-2 font-semibold'>Round</th>
              <th className='py-1 pr-2 font-semibold'>Interviewer</th>
              <th className='py-1 pr-2 text-right font-semibold'>Score</th>
              <th className='py-1 pr-2 text-right font-semibold'>Weight</th>
              <th className='py-1 text-right font-semibold'>Weighted</th>
            </tr>
          </thead>
          <tbody className='text-slate-700'>
            {app.rounds.map((r) => (
              <tr
                key={r.round}
                onClick={() => r.score && setOpen(open === r.round ? null : r.round)}
                className={`border-t border-slate-100 ${r.score ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              >
                <td className='py-1.5 pr-2 font-medium'>
                  {ROUND_LABEL[r.round]}
                  {r.score && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                        r.score.recommendation === 'hire'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {r.score.recommendation === 'hire' ? 'hire' : 'no hire'}
                    </span>
                  )}
                </td>
                <td className='py-1.5 pr-2'>{r.interviewerName ?? '—'}</td>
                <td className='py-1.5 pr-2 text-right font-mono'>
                  {r.score ? (
                    r.score.roundScore
                  ) : (
                    <span className='font-sans text-[11px] text-slate-400'>
                      {app.currentRound === r.round ? 'open now' : 'not scored yet'}
                    </span>
                  )}
                </td>
                <td className='py-1.5 pr-2 text-right font-mono'>
                  {r.weight === null ? '—' : `${r.weight}%`}
                </td>
                <td className='py-1.5 text-right font-mono'>
                  {r.score && r.weight !== null
                    ? Math.round(r.score.roundScore * r.weight) / 100
                    : '—'}
                </td>
              </tr>
            ))}
            <tr className='border-t-2 border-slate-200 font-semibold'>
              <td className='py-1.5 pr-2' colSpan={4}>
                Total{' '}
                <span className='font-normal text-slate-400'>
                  ({scored} of {app.rounds.length} rounds scored)
                </span>
              </td>
              <td className='py-1.5 text-right font-mono'>
                {app.scoreTotal === null ? '—' : `${app.scoreTotal} / 100`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {app.rounds
        .filter((r) => r.round === open && r.score)
        .map((r) => (
          <div key={r.round} className='space-y-1 rounded-md bg-slate-50 p-2'>
            {r.score!.scores.map((s) => (
              <div key={s.attribute}>
                <p className='text-slate-700'>
                  <span className='font-mono font-semibold'>{s.score}/4</span> · {s.attribute}
                </p>
                {s.evidence && <p className='pl-8 text-slate-500'>{s.evidence}</p>}
              </div>
            ))}
            {r.score!.notes && <p className='text-slate-500'>Notes: {r.score!.notes}</p>}
          </div>
        ))}
    </div>
  );
};

export default ScorecardSummary;

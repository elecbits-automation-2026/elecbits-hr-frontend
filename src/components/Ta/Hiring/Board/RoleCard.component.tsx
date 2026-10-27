import { PRIORITY_LABEL } from '@constants/Common/hiring.constants';

import {
  LIVE_STAGES,
  POSITION_ACCENT,
  POSITION_PILL,
  daysSince,
  docPill,
  type BoardPosition,
} from './board.shared';

const Stat = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => (
  <div>
    <p className='text-[10px] font-semibold uppercase tracking-wide text-slate-400'>{label}</p>
    <p className={`font-mono text-lg font-bold ${warn ? 'text-red-600' : 'text-slate-800'}`}>
      {value}
    </p>
  </div>
);

/**
 * One position as a card, in the old HR tool's "Open roles" style: status
 * accent on the left, JD / scorecard state, the numbers that matter, and a
 * warning when it's open with nobody in the pipeline.
 */
const RoleCard = ({
  item,
  onPipeline,
  onDetails,
}: {
  item: BoardPosition;
  onPipeline: () => void;
  onDetails: () => void;
}) => {
  const { line, position: p, apps } = item;
  const inFlight = apps.filter((a) => LIVE_STAGES.includes(a.stage)).length;
  const interviewing = apps.filter((a) => a.stage === 'interviewing').length;
  const offers = apps.filter((a) => a.stage === 'offered').length;
  const days = p.status === 'filled' || p.status === 'cancelled' ? null : daysSince(p.openedAt);
  const live = p.status === 'open' || p.status === 'interviewing';
  const pill = POSITION_PILL[p.status];
  const jd = docPill(p.documents.jd);
  const sc = docPill(p.documents.scorecard);

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border border-l-[3px] border-slate-200 bg-white p-4 ${POSITION_ACCENT[p.status]}`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <h3 className='truncate text-sm font-bold text-slate-800'>
            {line.roleTitle} <span className='font-normal text-slate-400'>#{p.number}</span>
          </h3>
          <p className='text-xs text-slate-500'>
            {line.requestCode && <span className='font-mono'>{line.requestCode} · </span>}
            {line.departmentName}
            {line.quarter && <> · {line.quarter}</>}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pill.cls}`}
        >
          {pill.label}
        </span>
      </div>

      <div className='flex flex-wrap gap-1.5 text-[11px]'>
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${PRIORITY_LABEL[line.priority].cls}`}
        >
          {PRIORITY_LABEL[line.priority].label}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${jd.cls}`}>JD {jd.label}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${sc.cls}`}>
          Scorecard {sc.label}
        </span>
      </div>

      <div className='grid grid-cols-4 gap-2'>
        <Stat label='In flight' value={String(inFlight)} />
        <Stat label='Interviews' value={String(interviewing)} />
        <Stat label='Offers' value={String(offers)} />
        <Stat
          label='Days open'
          value={days === null ? '—' : String(days)}
          warn={days !== null && days > 45}
        />
      </div>

      <p className='text-xs text-slate-500'>
        {p.recruiterName ? (
          <>
            Recruiter <span className='font-medium text-slate-700'>{p.recruiterName}</span>
          </>
        ) : (
          <span className='text-amber-700'>No recruiter yet</span>
        )}
        {line.taRm && <> · TA RM {line.taRm.name}</>}
      </p>

      {live && inFlight === 0 && (
        <p className='rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800'>
          ⚠ Open with nobody in the pipeline
        </p>
      )}

      <div className='mt-auto flex justify-end gap-2 border-t border-slate-100 pt-3'>
        <button
          type='button'
          onClick={onDetails}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
        >
          JD, scorecard &amp; recruiter
        </button>
        <button
          type='button'
          onClick={onPipeline}
          className='rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700'
        >
          See the pipeline →
        </button>
      </div>
    </article>
  );
};

export default RoleCard;

import type { LevelChange } from '@app-types/api.types';

/**
 * Every band change on record, newest first — written by the server when HR
 * edits the level, never typed in here.
 */
const PromotionHistory = ({
  history,
  emptyText = 'No band changes on record yet.',
}: {
  history: LevelChange[];
  emptyText?: string;
}) => {
  if (history.length === 0) return <p className='text-sm text-slate-400'>{emptyText}</p>;
  return (
    <ul className='space-y-1.5'>
      {[...history].reverse().map((h) => (
        <li key={h.at} className='flex flex-wrap items-baseline gap-2 text-sm'>
          <span className='font-mono text-xs text-slate-400'>{h.at.slice(0, 10)}</span>
          <span className='font-medium text-slate-700'>
            {h.from} → {h.to}
          </span>
          <span className='text-xs text-slate-400'>
            {h.to > h.from ? 'promotion' : 'band change'}
            {h.byName ? ` · by ${h.byName}` : ''}
            {h.trackId ? ' · closed the open roadmap' : ''}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default PromotionHistory;

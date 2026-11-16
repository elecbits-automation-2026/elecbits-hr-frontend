import { useState } from 'react';

import { SERIES_COLORS } from './chartColors';

export interface BarListRow {
  key: string;
  label: string;
  value: number;
  /** Extra line in the tooltip (e.g. "32% of the roster"). */
  hint?: string;
}

/**
 * A horizontal bar per category — magnitude in one hue (the title names the
 * series, so no legend). Bars start at the same baseline, with a 4px rounded
 * data end; the value is printed beside each bar so the list doubles as the
 * table view. Rows keep the order they are given (ordinal lists like bands
 * stay in band order; nominal ones are sorted by the caller).
 */
const BarList = ({
  title,
  rows,
  format = (n) => String(n),
  empty = 'Nothing to show yet.',
}: {
  title: string;
  rows: BarListRow[];
  format?: (n: number) => string;
  empty?: string;
}) => {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <figure className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
      <figcaption className='text-sm font-semibold text-slate-800'>{title}</figcaption>
      {rows.length === 0 || max === 0 ? (
        <p className='text-sm text-slate-500'>{empty}</p>
      ) : (
        <ul className='space-y-1'>
          {rows.map((r) => (
            <li
              key={r.key}
              onMouseEnter={() => setHover(r.key)}
              onMouseLeave={() => setHover(null)}
              className={`relative grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded px-1 py-1 text-sm ${
                hover === r.key ? 'bg-slate-50' : ''
              }`}
            >
              <span className='truncate text-slate-600' title={r.label}>
                {r.label}
              </span>
              <span className='h-2.5'>
                {r.value > 0 && (
                  <span
                    className='block h-full rounded-r'
                    style={{
                      width: `${Math.max(2, (r.value / max) * 100)}%`,
                      backgroundColor: SERIES_COLORS[0],
                    }}
                  />
                )}
              </span>
              <span className='w-12 text-right tabular-nums text-slate-800'>{format(r.value)}</span>
              {hover === r.key && r.hint && (
                <span className='pointer-events-none absolute -top-7 left-36 z-10 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-white shadow'>
                  {r.label}: {format(r.value)} · {r.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
};

export default BarList;

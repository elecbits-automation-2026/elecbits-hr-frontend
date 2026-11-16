import { useState } from 'react';

import { SERIES_COLORS } from './chartColors';

export interface ColumnSeries {
  key: string;
  label: string;
}

export interface ColumnPoint {
  key: string;
  /** Axis label (e.g. "Aug"). */
  label: string;
  /** Tooltip heading (e.g. "August 2026"). */
  title: string;
  /** One value per series, in series order. */
  values: number[];
  /** Extra tooltip line (e.g. "so far — month not over"). */
  note?: string;
}

const PLOT_H = 140;

/**
 * Columns over time on ONE axis (1–2 series of the same unit — never a second
 * scale). Columns rise from a shared baseline with a 4px rounded data end and
 * a 2px gap between paired bars; three recessive gridlines carry the scale.
 * Hovering a column group shows every series' value; with two series a legend
 * names them (identity is never colour alone).
 */
const ColumnChart = ({
  title,
  series,
  points,
  format = (n) => String(n),
  axisFormat,
  empty = 'Nothing to show yet.',
  footnote,
}: {
  title: string;
  series: ColumnSeries[];
  points: ColumnPoint[];
  format?: (n: number) => string;
  axisFormat?: (n: number) => string;
  empty?: string;
  footnote?: string;
}) => {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(0, ...points.flatMap((p) => p.values));
  const ticks = max > 0 ? [max, max / 2, 0] : [];
  const tick = axisFormat ?? format;

  return (
    <figure className='space-y-3 rounded-xl border border-slate-200 bg-white p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <figcaption className='text-sm font-semibold text-slate-800'>{title}</figcaption>
        {series.length > 1 && (
          <ul className='flex gap-3 text-xs text-slate-600'>
            {series.map((s, i) => (
              <li key={s.key} className='flex items-center gap-1.5'>
                <span
                  className='inline-block h-2.5 w-2.5 rounded-sm'
                  style={{ backgroundColor: SERIES_COLORS[i] }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {points.length === 0 || max === 0 ? (
        <p className='text-sm text-slate-500'>{empty}</p>
      ) : (
        <div className='flex gap-2'>
          {/* Scale: three recessive ticks, top / middle / zero. */}
          <div
            className='flex shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-slate-400'
            style={{ height: PLOT_H }}
          >
            {ticks.map((t) => (
              <span key={t} className='-translate-y-1/2 first:translate-y-0 last:translate-y-0'>
                {tick(t)}
              </span>
            ))}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='relative' style={{ height: PLOT_H }}>
              {[0, 0.5, 1].map((f) => (
                <div
                  key={f}
                  className={`absolute inset-x-0 border-t ${f === 1 ? 'border-slate-300' : 'border-slate-100'}`}
                  style={{ top: f * PLOT_H }}
                />
              ))}
              <div className='absolute inset-0 flex items-end gap-1'>
                {points.map((p) => (
                  <div
                    key={p.key}
                    onMouseEnter={() => setHover(p.key)}
                    onMouseLeave={() => setHover(null)}
                    className={`relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-t ${
                      hover === p.key ? 'bg-slate-50' : ''
                    }`}
                  >
                    {p.values.map((v, i) => (
                      <div
                        key={series[i]?.key ?? i}
                        className='w-full max-w-6 rounded-t'
                        style={{
                          height: v > 0 ? Math.max(2, (v / max) * PLOT_H) : 0,
                          backgroundColor: SERIES_COLORS[i],
                        }}
                      />
                    ))}
                    {hover === p.key && (
                      <div className='pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow'>
                        <p className='font-medium'>{p.title}</p>
                        {series.map((s, i) => (
                          <p key={s.key} className='flex items-center gap-1.5'>
                            <span
                              className='inline-block h-2 w-2 rounded-sm'
                              style={{ backgroundColor: SERIES_COLORS[i] }}
                            />
                            {s.label}: {format(p.values[i] ?? 0)}
                          </p>
                        ))}
                        {p.note && <p className='text-slate-300'>{p.note}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className='mt-1 flex gap-1'>
              {points.map((p) => (
                <span
                  key={p.key}
                  className='flex-1 truncate text-center text-[10px] text-slate-500'
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {footnote && <p className='text-xs text-slate-500'>{footnote}</p>}
    </figure>
  );
};

export default ColumnChart;

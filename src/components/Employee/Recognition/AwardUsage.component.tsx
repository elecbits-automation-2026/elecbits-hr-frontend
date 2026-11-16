import type { RecognitionBoard } from '@app-types/api.types';
import BarList from '@components/Common/Charts/BarList.component';
import { inrFull, inrShort } from '@components/Common/Charts/chartColors';
import ColumnChart from '@components/Common/Charts/ColumnChart.component';

const monthLabel = (ym: string, style: 'short' | 'long') =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: style,
    ...(style === 'long' ? { year: 'numeric' } : {}),
  });

const Tile = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className='rounded-xl border border-slate-200 bg-white p-4'>
    <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>{label}</p>
    <p className='mt-1 text-2xl font-semibold tabular-nums text-slate-800'>{value}</p>
    {note && <p className='text-xs text-slate-500'>{note}</p>}
  </div>
);

/**
 * "Is it being used?" (HR): approved awards over the last six months by
 * approval month, and the mix by award type. A quiet month is a month
 * nobody wrote anyone up — the point is to see that early.
 */
const AwardUsage = ({ board }: { board: RecognitionBoard }) => {
  const usage = board.usage;
  const current = usage[usage.length - 1]?.month;
  const awards = usage.reduce((n, u) => n + u.awards, 0);
  const people = usage.reduce((n, u) => n + u.people, 0);
  const value = usage.reduce((n, u) => n + u.valueInr, 0);

  const mix = new Map<string, number>();
  for (const u of usage) {
    for (const [type, n] of Object.entries(u.byType))
      mix.set(type, (mix.get(type) ?? 0) + (n ?? 0));
  }
  const quietMonths = usage.filter((u) => u.month !== current && u.awards === 0).length;

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <Tile label='Awards, last 6 months' value={String(awards)} />
        <Tile
          label='People recognised'
          value={String(people)}
          note='A team award counts everyone in it'
        />
        <Tile
          label='Value paid out'
          value={inrFull(value)}
          note='Paid in the next month’s payslip'
        />
      </div>
      <div className='grid gap-3 lg:grid-cols-2'>
        <ColumnChart
          title='Awards approved per month'
          series={[{ key: 'awards', label: 'Awards' }]}
          points={usage.map((u) => ({
            key: u.month,
            label: monthLabel(u.month, 'short'),
            title: monthLabel(u.month, 'long'),
            values: [u.awards],
            note: `${u.people} ${u.people === 1 ? 'person' : 'people'} · ${inrShort(u.valueInr)}${
              u.month === current ? ' · month not over' : ''
            }`,
          }))}
          empty='No awards approved in the last six months.'
          footnote={
            quietMonths > 0
              ? `${quietMonths} of the last five full months had no award at all.`
              : undefined
          }
        />
        <BarList
          title='Award mix, last 6 months'
          rows={[...mix.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([type, n]) => ({
              key: type,
              label: board.typeNames[type as keyof typeof board.typeNames] ?? type,
              value: n,
              hint: `${Math.round((n / Math.max(1, awards)) * 100)}% of awards`,
            }))}
          empty='No awards approved in the last six months.'
        />
      </div>
    </div>
  );
};

export default AwardUsage;

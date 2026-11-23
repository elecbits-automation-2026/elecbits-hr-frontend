import type { Employee } from '@app-types/api.types';
import BarList, { type BarListRow } from '@components/Common/Charts/BarList.component';

const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;
const TYPE_LABEL: Record<string, string> = {
  permanent: 'Permanent',
  intern: 'Intern',
  contract: 'Contract',
};
const TENURE = [
  { key: 'lt6', label: 'Under 6 months', max: 6 },
  { key: '6to12', label: '6–12 months', max: 12 },
  { key: '1to2', label: '1–2 years', max: 24 },
  { key: '2plus', label: '2 years +', max: Infinity },
] as const;

const todayIso = () => new Date().toLocaleDateString('en-CA');

/** Whole months between a joining date and today (0 for a future date). */
const monthsSince = (iso: string, today: string): number => {
  const [y1, m1, d1] = iso.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = today.split('-').map(Number) as [number, number, number];
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
};

const tenureText = (months: number) =>
  months < 12
    ? `${months} mo`
    : `${Math.floor(months / 12)} yr${months % 12 ? ` ${months % 12} mo` : ''}`;

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** First day of the current quarter (Apr / Jul / Oct / Jan). */
const quarterStart = (today: string) => {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const qm = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(qm).padStart(2, '0')}-01`;
};

const Tile = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className='rounded-xl border border-slate-200 bg-white p-4'>
    <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>{label}</p>
    <p className='mt-1 text-2xl font-semibold tabular-nums text-slate-800'>{value}</p>
    {note && <p className='text-xs text-slate-500'>{note}</p>}
  </div>
);

const pct = (n: number, total: number) =>
  total > 0 ? `${Math.round((n / total) * 100)}% of the roster` : undefined;

/**
 * People analytics (HRBP): headline numbers and headcount by department,
 * band, employment type and tenure — all drawn from the roster already on
 * the page. The roster = active + on notice; invited people (not joined yet)
 * and the Admin account (the company itself) are left out. Never shows pay.
 */
const PeopleAnalytics = ({ employees }: { employees: Employee[] }) => {
  const today = todayIso();
  const roster = employees.filter(
    (e) => (e.status === 'active' || e.status === 'exiting') && e.reportsTo !== null,
  );
  const invited = employees.filter((e) => e.status === 'invited').length;
  const onNotice = roster.filter((e) => e.status === 'exiting');
  const qStart = quarterStart(today);
  const joinedThisQuarter = roster.filter(
    (e) => e.dateOfJoining && e.dateOfJoining >= qStart && e.dateOfJoining <= today,
  );
  const withDoj = roster.filter((e) => e.dateOfJoining);
  const avgMonths =
    withDoj.length > 0
      ? withDoj.reduce((n, e) => n + monthsSince(e.dateOfJoining!, today), 0) / withDoj.length
      : null;

  const total = roster.length;
  const countBy = (keyOf: (e: Employee) => string) => {
    const counts = new Map<string, number>();
    for (const e of roster) counts.set(keyOf(e), (counts.get(keyOf(e)) ?? 0) + 1);
    return counts;
  };

  const byDept = countBy((e) => e.departmentName ?? 'No department');
  const deptRows: BarListRow[] = [...byDept.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ key: label, label, value, hint: pct(value, total) }));

  const byLevel = countBy((e) => e.level);
  const levelRows: BarListRow[] = LEVELS.map((l) => ({
    key: l,
    label: l,
    value: byLevel.get(l) ?? 0,
    hint: pct(byLevel.get(l) ?? 0, total),
  }));

  const byType = countBy((e) => e.employmentType ?? '');
  const typeRows: BarListRow[] = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, value]) => ({
      key: k || 'none',
      label: k ? (TYPE_LABEL[k] ?? k) : 'Not set',
      value,
      hint: pct(value, total),
    }));

  const byTenure = countBy((e) => {
    if (!e.dateOfJoining) return 'none';
    const m = monthsSince(e.dateOfJoining, today);
    return TENURE.find((t) => m < t.max)!.key;
  });
  const tenureRows: BarListRow[] = [
    ...TENURE.map((t) => ({
      key: t.key,
      label: t.label,
      value: byTenure.get(t.key) ?? 0,
      hint: pct(byTenure.get(t.key) ?? 0, total),
    })),
    ...(byTenure.get('none')
      ? [{ key: 'none', label: 'No joining date', value: byTenure.get('none')! }]
      : []),
  ];

  const sixMonthsAgo = (() => {
    const d = new Date(`${today}T00:00:00`);
    d.setMonth(d.getMonth() - 6);
    return d.toLocaleDateString('en-CA');
  })();
  const recentJoiners = roster
    .filter((e) => e.dateOfJoining && e.dateOfJoining >= sixMonthsAgo && e.dateOfJoining <= today)
    .sort((a, b) => b.dateOfJoining!.localeCompare(a.dateOfJoining!));

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Tile
          label='On the roster'
          value={String(total)}
          note={invited > 0 ? `+${invited} invited, not joined yet` : 'Active and on notice'}
        />
        <Tile
          label='Joined this quarter'
          value={String(joinedThisQuarter.length)}
          note={`Since ${fmtDate(qStart)}`}
        />
        <Tile
          label='On notice'
          value={String(onNotice.length)}
          note='Still counted in the roster'
        />
        <Tile
          label='Average tenure'
          value={avgMonths === null ? '—' : tenureText(Math.round(avgMonths))}
          note={
            withDoj.length < total
              ? `${total - withDoj.length} without a joining date left out`
              : 'From joining dates'
          }
        />
      </div>

      <div className='grid gap-3 lg:grid-cols-2'>
        <BarList title='Headcount by department' rows={deptRows} />
        <BarList title='Headcount by band' rows={levelRows} />
        <BarList title='Headcount by employment type' rows={typeRows} />
        <BarList title='Headcount by tenure' rows={tenureRows} />
      </div>

      <div className='grid gap-3 lg:grid-cols-2'>
        <section className='rounded-xl border border-slate-200 bg-white p-4'>
          <h2 className='text-sm font-semibold text-slate-800'>
            Joiners in the last six months ({recentJoiners.length})
          </h2>
          {recentJoiners.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Nobody joined in the last six months.</p>
          ) : (
            <ul className='mt-2 divide-y divide-slate-100 text-sm'>
              {recentJoiners.map((e) => (
                <li key={e.id} className='flex justify-between gap-2 py-1.5'>
                  <span className='text-slate-800'>
                    {e.name}
                    <span className='ml-2 text-xs text-slate-500'>
                      {e.departmentName ?? 'No department'}
                    </span>
                  </span>
                  <span className='shrink-0 text-xs text-slate-500'>
                    {fmtDate(e.dateOfJoining!)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className='rounded-xl border border-slate-200 bg-white p-4'>
          <h2 className='text-sm font-semibold text-slate-800'>On notice ({onNotice.length})</h2>
          {onNotice.length === 0 ? (
            <p className='mt-2 text-sm text-slate-500'>Nobody is serving notice.</p>
          ) : (
            <ul className='mt-2 divide-y divide-slate-100 text-sm'>
              {onNotice.map((e) => (
                <li key={e.id} className='flex justify-between gap-2 py-1.5'>
                  <span className='text-slate-800'>
                    {e.name}
                    <span className='ml-2 text-xs text-slate-500'>
                      {e.departmentName ?? 'No department'}
                    </span>
                  </span>
                  <span className='shrink-0 text-xs text-slate-500'>
                    {e.dateOfJoining
                      ? `served ${tenureText(monthsSince(e.dateOfJoining, today))}`
                      : 'no joining date'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default PeopleAnalytics;

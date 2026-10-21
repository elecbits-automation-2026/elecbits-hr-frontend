import type { EmployeeAttendance } from '@app-types/api.types';

interface WeekBucket {
  label: string;
  late: number;
  absent: number;
}

/** Monday-aligned week index within the month for a YYYY-MM-DD string. */
const weekOf = (date: string): number => Math.floor((Number(date.slice(8, 10)) - 1) / 7);

/**
 * Team totals of late check-ins and absent days per week of the current
 * month. Hand-rolled bars (no chart library): quiet weeks stay low and grey,
 * spikes stand out — the chart exists to highlight gaps, not to decorate.
 */
const TeamTrendChart = ({ months, today }: { months: EmployeeAttendance[]; today: string }) => {
  const buckets: WeekBucket[] = [0, 1, 2, 3, 4].map((i) => ({
    label: `W${i + 1}`,
    late: 0,
    absent: 0,
  }));

  for (const m of months) {
    for (const d of m.days) {
      if (d.date > today) continue;
      const bucket = buckets[weekOf(d.date)];
      if (!bucket) continue;
      if (d.checkInTiming === 'late' || d.checkInTiming === 'grace') bucket.late += 1;
      if (d.status === 'absent') bucket.absent += 1;
      if (d.status === 'half_day') bucket.absent += 0.5;
    }
  }

  // Drop trailing weeks that haven't started yet.
  const currentWeek = weekOf(today);
  const visible = buckets.slice(0, currentWeek + 1);
  const max = Math.max(1, ...visible.flatMap((b) => [b.late, b.absent]));
  const barH = (v: number) => Math.round((v / max) * 64);

  return (
    <div>
      <div className='flex items-end gap-4' style={{ height: 84 }}>
        {visible.map((b) => (
          <div key={b.label} className='flex flex-1 flex-col items-center gap-1'>
            <div className='flex items-end gap-1' style={{ height: 68 }}>
              <div
                title={`${b.late} late check-ins`}
                className={`w-4 rounded-t ${b.late > 0 ? 'bg-yellow-400' : 'bg-slate-200'}`}
                style={{ height: Math.max(3, barH(b.late)) }}
              />
              <div
                title={`${b.absent} absent days`}
                className={`w-4 rounded-t ${b.absent > 0 ? 'bg-red-500' : 'bg-slate-200'}`}
                style={{ height: Math.max(3, barH(b.absent)) }}
              />
            </div>
            <span className='text-[10px] text-slate-400'>{b.label}</span>
          </div>
        ))}
      </div>
      {/* Legend lives once in TeamInsights, shared with the load strip. */}
    </div>
  );
};

export default TeamTrendChart;

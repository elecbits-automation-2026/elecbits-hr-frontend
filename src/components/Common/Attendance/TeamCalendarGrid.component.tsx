import type { AttendanceDay, EmployeeAttendance } from '@app-types/api.types';

/**
 * The month wall: one row per person, one coloured cell per day (adopted from
 * the reference calendar the user supplied, in OUR colour allocation — each
 * state owns one hue across the whole app). Header dots flag days where
 * someone is away: blue for one person, red for more.
 */
const CELL: Record<
  AttendanceDay['status'],
  { cls: string; label: string } | null
> = {
  present: { cls: 'bg-green-500 text-white', label: 'Present' },
  wfh: { cls: 'bg-violet-500 text-white', label: 'Remote' },
  leave: { cls: 'bg-blue-500 text-white', label: 'Leave' },
  half_leave: { cls: 'bg-orange-400 text-white', label: 'Half-day leave' },
  half_day: { cls: 'bg-orange-500 text-white', label: 'Half day (auto-closed)' },
  absent: { cls: 'bg-red-500 text-white', label: 'Absent' },
  holiday: { cls: 'bg-slate-200 text-slate-500', label: 'Holiday' },
  weekend: { cls: 'bg-slate-100 text-slate-400', label: 'Weekend' },
  none: null,
};

const LEGEND: Array<{ cls: string; label: string }> = [
  { cls: 'bg-green-500', label: 'Present' },
  { cls: 'bg-violet-500', label: 'Remote' },
  { cls: 'bg-blue-500', label: 'Leave' },
  { cls: 'bg-orange-500', label: 'Half day' },
  { cls: 'bg-red-500', label: 'Absent' },
  { cls: 'bg-slate-200', label: 'Holiday' },
  { cls: 'bg-slate-100 border border-slate-200', label: 'Weekend' },
];

const AWAY: Array<AttendanceDay['status']> = ['leave', 'half_leave', 'wfh'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

const tooltip = (d: AttendanceDay): string => {
  const cell = CELL[d.status];
  const parts = [d.date, cell?.label ?? 'No record'];
  if (d.holidayName) parts.push(d.holidayName);
  if (d.leaveType) parts.push(`${d.leaveType} leave`);
  const inAt = time(d.checkInAt);
  const outAt = time(d.checkOutAt);
  if (inAt) parts.push(`in ${inAt}${outAt ? ` · out ${outAt}` : ''}`);
  return parts.join(' · ');
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

// A stable per-person tint for the initials disc, from the name itself.
const AVATAR_TINTS = [
  'bg-green-100 text-green-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
];
const tintOf = (name: string) =>
  AVATAR_TINTS[[...name].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATAR_TINTS.length];

const TeamCalendarGrid = ({ months, today }: { months: EmployeeAttendance[]; today: string }) => {
  const dates = months[0]?.days.map((d) => d.date) ?? [];
  if (dates.length === 0) return null;

  // Header dots: how many people are AWAY (leave / half-leave / remote) per day.
  const awayCount = dates.map(
    (_, i) => months.filter((m) => AWAY.includes(m.days[i]?.status ?? 'none')).length,
  );

  return (
    <div className='space-y-3'>
      <div className='overflow-x-auto'>
        <table className='border-separate' style={{ borderSpacing: '2px 6px' }}>
          <thead>
            <tr>
              <th className='sticky left-0 z-10 bg-white pr-3 text-left'></th>
              {dates.map((date, i) => {
                const dow = DOW[new Date(`${date}T00:00:00`).getDay()];
                return (
                  <th key={date} className='min-w-7 text-center font-normal'>
                    <span className='block text-[10px] text-slate-400'>{dow}</span>
                    <span
                      className={`mx-auto block h-1.5 w-1.5 rounded-full ${
                        awayCount[i]! > 1
                          ? 'bg-red-500'
                          : awayCount[i] === 1
                            ? 'bg-blue-500'
                            : 'bg-slate-200'
                      }`}
                      title={
                        awayCount[i]
                          ? `${awayCount[i]} away on ${date}`
                          : `nobody away on ${date}`
                      }
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.employee.id}>
                <td className='sticky left-0 z-10 bg-white pr-3'>
                  <div className='flex max-w-44 items-center gap-2'>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${tintOf(m.employee.name)}`}
                    >
                      {initials(m.employee.name)}
                    </span>
                    <span className='truncate text-sm text-slate-700' title={m.employee.name}>
                      {m.employee.name}
                    </span>
                  </div>
                </td>
                {m.days.map((d) => {
                  const cell = CELL[d.status];
                  const isToday = d.date === today;
                  return (
                    <td key={d.date} className='text-center'>
                      <span
                        title={tooltip(d)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] tabular-nums ${
                          cell ? cell.cls : 'border border-slate-200 text-slate-400'
                        } ${isToday ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}
                      >
                        {Number(d.date.slice(8))}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500'>
        {LEGEND.map((l) => (
          <span key={l.label} className='flex items-center gap-1.5'>
            <span className={`h-2.5 w-2.5 rounded-sm ${l.cls}`} />
            {l.label}
          </span>
        ))}
        <span className='flex items-center gap-1.5'>
          <span className='h-2.5 w-2.5 rounded-md border border-slate-200' />
          No record
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-blue-500' />
          someone away
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-red-500' />
          several away
        </span>
      </div>
    </div>
  );
};

export default TeamCalendarGrid;

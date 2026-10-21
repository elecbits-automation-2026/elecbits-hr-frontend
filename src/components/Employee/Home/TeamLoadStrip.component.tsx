import type { EmployeeAttendance } from '@app-types/api.types';
import type { Insight } from '@insights';

const DOT: Record<Insight['severity'], string> = {
  alert: 'bg-red-500',
  warn: 'bg-amber-400',
  info: 'bg-slate-300',
};

// Registry order is by SOURCE, not severity — rank explicitly for "worst".
const SEVERITY_RANK: Record<Insight['severity'], number> = { alert: 0, warn: 1, info: 2 };

// Half-day is ORANGE and late is YELLOW across the whole panel — each state
// owns one hue so nothing reads ambiguously (user decision).
const SEG = {
  present: 'bg-green-500',
  leave: 'bg-blue-400',
  half: 'bg-orange-500',
  absent: 'bg-red-500',
} as const;

/**
 * One slim stacked bar per report: how their working days so far split into
 * present / leave / half-day / absent, with a dot for their worst insight.
 * Zero-data people render an empty grey track, never NaN widths.
 */
const TeamLoadStrip = ({
  months,
  today,
  insights,
  onAppreciate,
}: {
  months: EmployeeAttendance[];
  today: string;
  insights: Insight[];
  /** Opens the feedback modal with an appreciation draft for this person. */
  onAppreciate: (person: { id: string; name: string }, presentDays: number) => void;
}) => (
  <div className='space-y-2'>
    {months.map((m) => {
      const past = m.days.filter((d) => d.date <= today);
      const half = past.filter((d) => d.status === 'half_day').length;
      const present = m.summary.present - half * 0.5;
      const leave = m.summary.leave + m.summary.wfh;
      const absent = m.summary.absent - half * 0.5;
      const total = Math.max(present + leave + half + absent, 0);
      const pct = (v: number) => (total > 0 ? `${(v / total) * 100}%` : '0%');
      const worst = insights
        .filter((i) => i.person?.id === m.employee.id)
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];

      return (
        <div key={m.employee.id} className='flex items-center gap-3'>
          <span className='flex w-36 shrink-0 items-center gap-1.5 truncate text-xs text-slate-600'>
            {worst && <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[worst.severity]}`} />}
            {m.employee.name}
          </span>
          <div className='flex h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100'>
            {total > 0 && (
              <>
                <div className={SEG.present} style={{ width: pct(present) }} title={`${present} present`} />
                <div className={SEG.leave} style={{ width: pct(leave) }} title={`${leave} leave/remote`} />
                <div className={SEG.half} style={{ width: pct(half) }} title={`${half} half-days`} />
                <div className={SEG.absent} style={{ width: pct(absent) }} title={`${absent} absent`} />
              </>
            )}
          </div>
          <button
            type='button'
            onClick={() => onAppreciate({ id: m.employee.id, name: m.employee.name }, present)}
            title='Draft an appreciation note — you review and send'
            className='shrink-0 text-xs text-green-600 hover:underline'
          >
            + appreciate
          </button>
        </div>
      );
    })}
    {/* Legend lives once in TeamInsights, shared with the trend chart. */}
  </div>
);

export default TeamLoadStrip;

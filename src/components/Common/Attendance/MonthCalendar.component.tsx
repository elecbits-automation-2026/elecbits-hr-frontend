import { useState } from 'react';

import type {
  AttendanceDay,
  AttendanceDayStatus,
  CheckInTiming,
  CheckOutTiming,
} from '@app-types/api.types';

const STATUS_STYLES: Record<AttendanceDayStatus, string> = {
  none: 'bg-white text-slate-300',
  weekend: 'bg-slate-100 text-slate-400',
  holiday: 'bg-amber-100 text-amber-800',
  leave: 'bg-blue-100 text-blue-800',
  half_leave: 'bg-blue-50 text-blue-700',
  wfh: 'bg-purple-100 text-purple-800',
  present: 'bg-green-100 text-green-800',
  half_day: 'bg-orange-100 text-orange-800',
  absent: 'bg-red-100 text-red-700',
};

const LEGEND: Array<{ status: AttendanceDayStatus; label: string }> = [
  { status: 'present', label: 'Present' },
  { status: 'half_day', label: 'Half day (no check-out)' },
  { status: 'absent', label: 'Absent' },
  { status: 'leave', label: 'Leave' },
  { status: 'half_leave', label: 'Half leave' },
  { status: 'wfh', label: 'Remote (approved)' },
  { status: 'holiday', label: 'Holiday' },
  { status: 'weekend', label: 'Weekend' },
];

/** Corner-dot colors: green on time, amber within grace, red beyond —
 *  purple when late/early but the full scheduled hours were worked. */
const TIMING_DOT: Record<'ontime' | 'grace' | 'late' | 'early' | 'compensated', string> = {
  ontime: 'bg-green-500',
  grace: 'bg-amber-400',
  late: 'bg-red-500',
  early: 'bg-red-500',
  compensated: 'bg-purple-500',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const longDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const inTimingLabel: Record<CheckInTiming, string> = {
  ontime: 'on time',
  grace: 'slightly late',
  late: 'late',
  compensated: 'late, full hours worked',
};
const outTimingLabel: Record<CheckOutTiming, string> = {
  ontime: 'on time',
  grace: 'slightly early',
  early: 'left early',
  compensated: 'full hours worked',
};

const title = (d: AttendanceDay, isToday: boolean): string => {
  const parts = [isToday && d.status === 'none' ? 'today — not checked in yet' : d.status.replace('_', ' ')];
  if (isToday && d.status !== 'none') parts.unshift('today');
  if (d.holidayName) parts.push(d.holidayName);
  if (d.leaveType) parts.push(`${d.leaveType} leave`);
  if (d.checkInTiming) parts.push(`in ${inTimingLabel[d.checkInTiming]}`);
  if (d.checkOutTiming) parts.push(`out ${outTimingLabel[d.checkOutTiming]}`);
  if (d.workedHours !== null) parts.push(`${d.workedHours}h`);
  return parts.join(' · ');
};

/** What one clicked day reads as — future days simply have no data yet. */
const DayDetail = ({ day, isToday }: { day: AttendanceDay; isToday: boolean }) => {
  const rows: Array<[string, string, string?]> = [];

  if (day.status === 'none' && !isToday) {
    return (
      <p className='text-sm text-slate-400'>No data — this day hasn’t happened yet.</p>
    );
  }
  if (day.status === 'holiday') rows.push(['Holiday', day.holidayName ?? '—']);
  if (day.status === 'weekend') rows.push(['Day', 'Weekend']);
  if (day.status === 'leave' || day.status === 'half_leave') {
    rows.push(['Leave', `${day.leaveType ?? ''}${day.status === 'half_leave' ? ' (half day)' : ''}`]);
  }
  if (day.status === 'wfh') rows.push(['Day', 'Remote work (approved)']);
  if (day.status === 'half_day') {
    rows.push(['Day', 'No check-out — auto-closed as half day; regularize to fix']);
  }
  if (day.status === 'absent') rows.push(['Day', 'Absent — no punch recorded']);
  if (isToday && !day.checkInAt) rows.push(['Today', 'Not checked in yet']);

  if (day.checkInAt) {
    rows.push([
      'Check in',
      `${time(day.checkInAt)}${day.checkInTiming ? ` (${inTimingLabel[day.checkInTiming]})` : ''}`,
      day.checkInTiming ?? undefined,
    ]);
    rows.push([
      'Check out',
      day.checkOutAt
        ? `${time(day.checkOutAt)}${day.checkOutTiming ? ` (${outTimingLabel[day.checkOutTiming]})` : ''}`
        : isToday
          ? 'still working'
          : '—',
      day.checkOutTiming ?? undefined,
    ]);
    if (day.workedHours !== null) rows.push(['Worked', `${day.workedHours}h`]);
    if (day.source) {
      rows.push([
        'Source',
        day.source === 'regularized'
          ? 'regularized'
          : day.source === 'remote'
            ? 'remote (approved)'
            : 'office',
      ]);
    }
  }

  const valueClass = (timing?: string) =>
    timing === 'ontime'
      ? 'text-green-700'
      : timing === 'grace'
        ? 'text-amber-600'
        : timing === 'late' || timing === 'early'
          ? 'text-red-600'
          : 'text-slate-700';

  return (
    <div className='grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4'>
      {rows.map(([label, value, timing]) => (
        <div key={label}>
          <span className='text-xs text-slate-400'>{label}</span>
          <div className={valueClass(timing)}>{value}</div>
        </div>
      ))}
    </div>
  );
};

/**
 * Month grid, Monday-first, colored by classified status; today is ringed.
 * Corner dots are punctuality: top-left = check-in (late), top-right =
 * check-out (left early) — green / amber (≤ grace) / red. Clicking a date
 * opens its detail below — future dates read "no data".
 */
const MonthCalendar = ({ days }: { days: AttendanceDay[] }) => {
  const [selected, setSelected] = useState<string | null>(null);
  if (days.length === 0) return null;
  // getDay(): 0=Sun…6=Sat → Monday-first offset for the 1st of the month.
  const firstDow = new Date(`${days[0]!.date}T00:00:00`).getDay();
  const offset = (firstDow + 6) % 7;
  const today = new Date().toLocaleDateString('en-CA');
  const selectedDay = days.find((d) => d.date === selected);

  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400'>
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-1'>
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((d) => {
          const isToday = d.date === today;
          const isSelected = d.date === selected;
          return (
            <button
              type='button'
              key={d.date}
              title={title(d, isToday)}
              onClick={() => setSelected(isSelected ? null : d.date)}
              className={`relative flex h-12 cursor-pointer items-center justify-center rounded-md text-sm hover:opacity-80 ${
                // Today reads as live, never as a faded future cell.
                isToday && d.status === 'none'
                  ? 'bg-brand-50 text-brand-700'
                  : STATUS_STYLES[d.status]
              } ${isToday ? 'font-semibold' : ''} ${
                isSelected ? 'ring-2 ring-slate-700' : isToday ? 'ring-2 ring-brand-500' : ''
              }`}
            >
              {Number(d.date.slice(8))}
              {d.checkInTiming && (
                <span
                  className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full ${TIMING_DOT[d.checkInTiming]}`}
                />
              )}
              {d.checkOutTiming && (
                <span
                  className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${TIMING_DOT[d.checkOutTiming]}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className='rounded-lg border border-slate-200 bg-slate-50 p-4'>
          <div className='mb-2 flex items-center justify-between'>
            <span className='text-sm font-semibold text-slate-700'>
              {longDate(selectedDay.date)}
              {selectedDay.date === today && (
                <span className='ml-2 text-xs font-normal text-brand-600'>today</span>
              )}
            </span>
            <button
              type='button'
              onClick={() => setSelected(null)}
              className='text-xs text-slate-400 hover:text-slate-600'
            >
              ✕
            </button>
          </div>
          <DayDetail day={selectedDay} isToday={selectedDay.date === today} />
        </div>
      )}

      <div className='flex flex-wrap gap-3 text-xs text-slate-500'>
        {LEGEND.map((l) => (
          <span key={l.status} className='flex items-center gap-1'>
            <span className={`inline-block h-3 w-3 rounded ${STATUS_STYLES[l.status]}`} />
            {l.label}
          </span>
        ))}
        <span className='flex items-center gap-2'>
          <span className='text-slate-400'>·</span>
          Dots: <span className='font-medium'>↖ in</span> / <span className='font-medium'>↗ out</span>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-1.5 w-1.5 rounded-full bg-green-500' /> on time
          </span>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-1.5 w-1.5 rounded-full bg-amber-400' /> ≤15 min off
          </span>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-1.5 w-1.5 rounded-full bg-red-500' /> late / left early
          </span>
        </span>
      </div>
    </div>
  );
};

export default MonthCalendar;

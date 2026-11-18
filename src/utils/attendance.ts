import type { AttendanceDay } from '@app-types/api.types';

/** Credit per classified day: full 1, half 0.5; days that do not count are null. */
export const credit = (d: AttendanceDay): number | null => {
  switch (d.status) {
    case 'present':
    case 'wfh':
      return 1;
    case 'half_day':
    case 'half_leave':
      return 0.5;
    case 'absent':
      return 0;
    default:
      return null; // week off, holiday, full leave, not yet
  }
};

/**
 * Attendance % up to `today`: credit over the days that count — week offs,
 * holidays and approved full-day leave are left out; today counts once
 * marked. Null with no countable day yet.
 */
export const attendancePct = (days: AttendanceDay[], today: string) => {
  const counted = days
    .filter((d) => d.date <= today)
    .map(credit)
    .filter((c): c is number => c !== null);
  if (counted.length === 0) return null;
  const got = counted.reduce((n, c) => n + c, 0);
  return { pct: Math.round((got / counted.length) * 100), got, of: counted.length };
};

/**
 * Average hours on the working days that have hours recorded (a check-in AND
 * a check-out), up to `today`. Weekends and holidays never carry hours.
 */
export const averageHours = (days: AttendanceDay[], today: string) => {
  const worked = days
    .filter((d) => d.date <= today && d.workedHours !== null)
    .map((d) => d.workedHours as number);
  if (worked.length === 0) return null;
  return {
    avg: Math.round((worked.reduce((n, h) => n + h, 0) / worked.length) * 10) / 10,
    days: worked.length,
  };
};

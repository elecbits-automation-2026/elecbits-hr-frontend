import { TEAM_ATTENDANCE_ROUTE } from '@constants/Common/navigation/routes.constants';
import { THRESHOLDS } from '../thresholds';
import type { Insight, InsightSource } from '../types';

/**
 * Attendance patterns per report, computed from the classified month the
 * Team-attendance page already fetches. Exception-first: a person with a
 * normal month contributes nothing.
 */
export const attendanceSource: InsightSource = ({ months, today }) => {
  const out: Insight[] = [];

  for (const m of months) {
    const person = { id: m.employee.id, name: m.employee.name };
    const past = m.days.filter((d) => d.date <= today);

    // Late streak: late/grace check-ins inside the recent working-day window.
    const window = past
      .filter((d) => d.checkInAt !== null)
      .slice(-THRESHOLDS.LATE_STREAK_WINDOW_DAYS);
    const lateInWindow = window.filter(
      (d) => d.checkInTiming === 'late' || d.checkInTiming === 'grace',
    ).length;
    if (lateInWindow >= THRESHOLDS.LATE_STREAK_COUNT) {
      out.push({
        id: `late-streak:${person.id}`,
        severity: 'warn',
        person,
        title: 'Late check-in streak',
        detail: `${lateInWindow} late check-ins in the last ${window.length} punched days`,
        to: TEAM_ATTENDANCE_ROUTE,
      });
    }

    // Absence this month (the only status that becomes LOP).
    const absent = m.summary.absent;
    if (absent > 0) {
      out.push({
        id: `absent:${person.id}`,
        severity: absent >= THRESHOLDS.ABSENT_ALERT ? 'alert' : 'warn',
        person,
        title: 'Unaccounted absence',
        detail: `${absent} absent day${absent === 1 ? '' : 's'} this month — flows into LOP unless leave covers it`,
        to: TEAM_ATTENDANCE_ROUTE,
      });
    }

    // Forgotten checkouts: past days auto-closed as half-day.
    const openPunches = past.filter((d) => d.status === 'half_day').length;
    if (openPunches >= THRESHOLDS.OPEN_PUNCH_WARN) {
      out.push({
        id: `open-punch:${person.id}`,
        severity: 'warn',
        person,
        title: 'Forgotten checkouts',
        detail: `${openPunches} day${openPunches === 1 ? '' : 's'} auto-closed as half-day — HRBP can regularize genuine ones`,
        to: TEAM_ATTENDANCE_ROUTE,
      });
    }

    // Compensated pattern: consistently late but working full hours.
    const compensated = past.filter((d) => d.checkInTiming === 'compensated').length;
    if (compensated >= THRESHOLDS.COMPENSATED_INFO) {
      out.push({
        id: `compensated:${person.id}`,
        severity: 'info',
        person,
        title: 'Shifted hours pattern',
        detail: `${compensated} days late in but full hours worked — maybe their natural schedule differs from the zone's`,
        to: TEAM_ATTENDANCE_ROUTE,
      });
    }
  }

  return out;
};

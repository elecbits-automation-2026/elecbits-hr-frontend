import { TEAM_LEAVES_ROUTE } from '@constants/Common/navigation/routes.constants';
import { THRESHOLDS } from '../thresholds';
import type { Insight, InsightSource } from '../types';

/**
 * Leave-usage patterns across the team's requests (the Team-leaves data).
 * Burnout runs both ways: too much unplanned absence is visible elsewhere,
 * too LITTLE leave is only visible here.
 */
export const leavesSource: InsightSource = ({ leaves, months, today }) => {
  const out: Insight[] = [];
  const month = Number(today.slice(5, 7));
  const year = today.slice(0, 4);

  for (const m of months) {
    const person = { id: m.employee.id, name: m.employee.name };
    const theirApproved = leaves.filter(
      (l) =>
        l.employee.id === person.id &&
        l.status === 'approved' &&
        l.startDate.startsWith(year),
    );

    if (month >= THRESHOLDS.NO_LEAVE_FROM_MONTH && theirApproved.length === 0) {
      out.push({
        id: `no-leave:${person.id}`,
        severity: 'info',
        person,
        title: 'No leave taken this year',
        detail: 'Zero approved leave so far — worth a nudge before year-end burnout and balance lapse',
        to: TEAM_LEAVES_ROUTE,
      });
    }

    const unpaidDays = theirApproved
      .filter((l) => l.type === 'unpaid')
      .reduce((sum, l) => sum + l.days, 0);
    if (unpaidDays > 0) {
      out.push({
        id: `unpaid:${person.id}`,
        severity: 'warn',
        person,
        title: 'Unpaid leave in use',
        detail: `${unpaidDays} unpaid day${unpaidDays === 1 ? '' : 's'} this year — paid balances may be exhausted`,
        to: TEAM_LEAVES_ROUTE,
      });
    }
  }

  return out;
};

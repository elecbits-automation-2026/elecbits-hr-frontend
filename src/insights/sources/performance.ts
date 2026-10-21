import { PERFORMANCE_ROUTE } from '@constants/Common/navigation/routes.constants';
import { THRESHOLDS } from '../thresholds';
import type { Insight, InsightSource } from '../types';

/**
 * The performance layer's derived alerts (batch 3): goal risk and
 * work-update discipline, read from the same /goals/team and
 * /work-updates/team data the performance page shows. Null scores are
 * UNSCORED, never failures — they are excluded from every average here.
 */
export const performanceSource: InsightSource = ({ goals, updates }) => {
  const out: Insight[] = [];

  for (const row of goals) {
    const person = { id: row.employee.id, name: row.employee.name };

    if (row.goalCount === 0) {
      out.push({
        id: `no-goals:${person.id}`,
        severity: 'info',
        person,
        title: 'No goals this quarter',
        detail: 'Nothing to measure yet — set weighted goals so attainment means something',
        to: PERFORMANCE_ROUTE,
      });
      continue;
    }

    if (row.atRisk > 0) {
      out.push({
        id: `goals-at-risk:${person.id}`,
        severity: 'alert',
        person,
        title: `${row.atRisk} goal${row.atRisk === 1 ? '' : 's'} at risk`,
        detail: 'Under 40% progress with the due date inside 30 days — worth a check-in',
        to: PERFORMANCE_ROUTE,
      });
    }
  }

  for (const row of updates) {
    const person = { id: row.employee.id, name: row.employee.name };

    if (row.updates.length === 0) {
      out.push({
        id: `no-updates:${person.id}`,
        severity: 'warn',
        person,
        title: 'No work updates this week',
        detail: 'Nothing submitted in the last 7 days — the daily sheet has gone quiet',
        to: PERFORMANCE_ROUTE,
      });
      continue;
    }

    const scored = row.updates.filter((u) => u.score !== null);
    if (scored.length >= THRESHOLDS.LOW_ALIGNMENT_MIN_SCORED) {
      const avg = scored.reduce((sum, u) => sum + (u.score ?? 0), 0) / scored.length;
      if (avg < THRESHOLDS.LOW_ALIGNMENT_SCORE) {
        out.push({
          id: `low-alignment:${person.id}`,
          severity: 'warn',
          person,
          title: 'Updates drifting from goals',
          detail: `Average alignment ${Math.round(avg)}/100 this week — the daily work may not be serving the quarter's goals`,
          to: PERFORMANCE_ROUTE,
        });
      }
    }
  }

  return out;
};

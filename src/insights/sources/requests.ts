import {
  TEAM_ATTENDANCE_ROUTE,
  TEAM_LEAVES_ROUTE,
} from '@constants/Common/navigation/routes.constants';
import { THRESHOLDS } from '../thresholds';
import type { Insight, InsightSource } from '../types';

const LIVE = ['pending', 'partially_approved'];

const hours = (iso: string): number => (Date.now() - new Date(iso).getTime()) / 3_600_000;

/**
 * Requests sitting on the viewer's RM slot — the "waiting on you" half of the
 * old Home strip, now with ageing so stale ones escalate instead of blending in.
 */
export const requestsSource: InsightSource = ({ leaves, wfh }) => {
  const out: Insight[] = [];

  for (const l of leaves) {
    if (!LIVE.includes(l.status) || l.rmApprovedBy || !l.rmRequired) continue;
    const age = hours(l.createdAt);
    const stale = age >= THRESHOLDS.AGING_HOURS;
    out.push({
      id: `leave-wait:${l.id}`,
      severity: stale ? 'warn' : 'info',
      person: { id: l.employee.id, name: l.employee.name },
      title: stale ? 'Leave request going stale' : 'Leave request waiting on you',
      detail: `${l.type} · ${l.startDate}${l.endDate !== l.startDate ? ` → ${l.endDate}` : ''} · waiting ${Math.floor(age)}h`,
      to: TEAM_LEAVES_ROUTE,
    });
  }

  for (const w of wfh) {
    if (!LIVE.includes(w.status) || w.rmApprovedBy) continue;
    const age = hours(w.createdAt);
    const stale = age >= THRESHOLDS.AGING_HOURS;
    out.push({
      id: `wfh-wait:${w.id}`,
      severity: stale ? 'warn' : 'info',
      person: { id: w.employee.id, name: w.employee.name },
      title: stale ? 'Remote request going stale' : 'Remote request waiting on you',
      detail: `${w.startDate}${w.endDate !== w.startDate ? ` → ${w.endDate}` : ''} · waiting ${Math.floor(age)}h`,
      to: TEAM_ATTENDANCE_ROUTE,
    });
  }

  return out;
};

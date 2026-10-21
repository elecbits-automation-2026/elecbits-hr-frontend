import type {
  EmployeeAttendance,
  LeaveRequest,
  TeamGoalsRow,
  TeamUpdatesRow,
  WfhRequest,
} from '@app-types/api.types';

/**
 * One actionable observation about someone on the team. The shape is the
 * CONTRACT of the insights system: today insights are computed client-side
 * from data the Home page already fetches; a future `GET /insights/team`
 * (KPI tracking, worksheet compliance, …) serves the same shape and the UI
 * does not change.
 */
export interface Insight {
  id: string;
  /** alert = act now · warn = look this week · info = good to know. */
  severity: 'alert' | 'warn' | 'info';
  person?: { id: string; name: string };
  title: string;
  detail: string;
  /** Optional route the insight links to (e.g. the queue that clears it). */
  to?: string;
}

/** Everything an insight source may read. */
export interface TeamInputs {
  months: EmployeeAttendance[];
  leaves: LeaveRequest[];
  wfh: WfhRequest[];
  /** Per-report goal sheet for the current cycle (empty for non-RMs). */
  goals: TeamGoalsRow[];
  /** Per-report work updates over the last week (empty for non-RMs). */
  updates: TeamUpdatesRow[];
  /** Local YYYY-MM-DD — sources must not look past it. */
  today: string;
}

/** A source turns team data into observations. New domains = new sources. */
export type InsightSource = (inputs: TeamInputs) => Insight[];

export const SEVERITY_ORDER: Record<Insight['severity'], number> = {
  alert: 0,
  warn: 1,
  info: 2,
};

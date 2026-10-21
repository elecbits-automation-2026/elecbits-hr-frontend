/**
 * Every insight threshold in one place, deliberately tunable. These encode
 * management policy, not code structure — change numbers here, never inside
 * the sources.
 */
export const THRESHOLDS = {
  /** Late (or grace) check-ins within the last N working days → streak. */
  LATE_STREAK_COUNT: 3,
  LATE_STREAK_WINDOW_DAYS: 7,
  /** Absent days this month: warn at the first, alert from here. */
  ABSENT_ALERT: 3,
  /** Half-days caused by missing checkouts this month → warn. */
  OPEN_PUNCH_WARN: 2,
  /** Compensated (late but full hours) days this month → info pattern. */
  COMPENSATED_INFO: 3,
  /** A request sitting unanswered on the RM slot longer than this → warn. */
  AGING_HOURS: 48,
  /** From this month onward, zero approved leave all year → burnout nudge. */
  NO_LEAVE_FROM_MONTH: 9,
  /** Weekly avg work-update score below this (≥ MIN scored) → drifting. */
  LOW_ALIGNMENT_SCORE: 40,
  LOW_ALIGNMENT_MIN_SCORED: 2,
} as const;

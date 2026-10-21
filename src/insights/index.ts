import { attendanceSource } from './sources/attendance';
import { leavesSource } from './sources/leaves';
import { performanceSource } from './sources/performance';
import { requestsSource } from './sources/requests';
import { SEVERITY_ORDER, type Insight, type InsightSource, type TeamInputs } from './types';

/**
 * The registry. Adding a future domain is ONE new file in sources/ exporting
 * `(inputs) => Insight[]` plus a line here — the Home panel and the Insight
 * contract never change. (Batch 3 did exactly that: performanceSource.)
 */
const SOURCES: InsightSource[] = [
  requestsSource,
  attendanceSource,
  leavesSource,
  performanceSource,
];

export const computeTeamInsights = (inputs: TeamInputs): Insight[] =>
  SOURCES.flatMap((source) => source(inputs)).sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.person?.name ?? '').localeCompare(b.person?.name ?? ''),
  );

export type { Insight, TeamInputs } from './types';

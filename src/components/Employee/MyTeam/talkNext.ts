import type { DailyKpiRow, TeamCareerRow, TeamMember, Training } from '@app-types/api.types';

const DAY_MS = 86_400_000;

export interface Ranked {
  member: TeamMember;
  score: number;
  reasons: string[];
  attainment: number | null;
  recognitions: number;
  openTrainings: number;
  hasTrack: boolean;
}

/**
 * Who to talk to next (learner, 2026-11-16): each report scored from what is
 * already on record, highest first. A point list, not a verdict —
 *   +3 no roadmap conversation open and no award in 90 days (growth is quiet);
 *   +2 goal attainment under the department target past mid-quarter;
 *   +1 per Daily KPI flag today (max 3);
 *   +1 an overdue training.
 * Ties go to the lower goal attainment. Nobody with a score of 0 is listed.
 */
export const rankTalkNext = (
  members: TeamMember[],
  kpi: DailyKpiRow[],
  career: TeamCareerRow[],
  trainings: Training[],
): Ranked[] =>
  members
    .filter((m) => m.status !== 'invited')
    .map((m) => {
      const k = kpi.find((r) => r.employee.id === m.id);
      const c = career.find((r) => r.employee.id === m.id);
      const mine = trainings.filter((t) => t.employee.id === m.id && t.status === 'assigned');
      const overdue = mine.filter((t) => t.overdue).length;
      const reasons: string[] = [];
      let score = 0;
      const quietSince =
        c &&
        !c.track &&
        (!c.lastRecognizedAt || Date.now() - Date.parse(c.lastRecognizedAt) > 90 * DAY_MS);
      if (quietSince) {
        score += 3;
        reasons.push(
          c.lastRecognizedAt
            ? 'No roadmap conversation, and no award in 90 days'
            : 'No roadmap conversation, and never recognised',
        );
      }
      if (k?.alerts.some((a) => a.code === 'attainment_below_target')) {
        score += 2;
        reasons.push(`Goals at ${k.goals.attainment}% — target ${k.targets.attainmentPct}%`);
      }
      const flags = (k?.alerts ?? []).filter((a) => a.code !== 'attainment_below_target');
      if (flags.length > 0) {
        score += Math.min(3, flags.length);
        reasons.push(`Flagged today: ${flags.map((a) => a.title.toLowerCase()).join('; ')}`);
      }
      if (overdue > 0) {
        score += 1;
        reasons.push(`${overdue} overdue training${overdue === 1 ? '' : 's'}`);
      }
      return {
        member: m,
        score,
        reasons,
        attainment: k?.goals.attainment ?? null,
        recognitions: c?.recognitions ?? 0,
        openTrainings: mine.length,
        hasTrack: !!c?.track,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || (a.attainment ?? 101) - (b.attainment ?? 101));

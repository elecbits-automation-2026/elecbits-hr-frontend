import type { OnboardingPhase, OnboardingTask } from '@app-types/api.types';

/** The three SOP phases, in order, with their day offset from the start date. */
export const ONBOARDING_PHASES: Array<{
  key: OnboardingPhase;
  title: string;
  offset: string;
  days: number;
}> = [
  { key: 'before_start', title: 'Before you start', offset: 'joining −7 days', days: -7 },
  { key: 'week_one', title: 'Week one', offset: 'joining day', days: 0 },
  { key: 'first_30', title: 'First 30 days', offset: 'joining +30 days', days: 30 },
];

export const phaseTitle = (key: OnboardingPhase) =>
  ONBOARDING_PHASES.find((p) => p.key === key)?.title ?? key;

/**
 * "You are here": the earliest phase that still has an open step — the same
 * rule as the old tool (the phase of the next open step). Null once every
 * step is done. The server sends the same thing on the HR queue rows.
 */
export const currentPhaseOf = (
  tasks: Array<Pick<OnboardingTask, 'phase' | 'done'>>,
): OnboardingPhase | null =>
  ONBOARDING_PHASES.find((p) => tasks.some((t) => t.phase === p.key && !t.done))?.key ?? null;

/** A YYYY-MM-DD date moved by `days`, kept as YYYY-MM-DD (no timezone drift). */
export const addDays = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

export const fmtDay = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

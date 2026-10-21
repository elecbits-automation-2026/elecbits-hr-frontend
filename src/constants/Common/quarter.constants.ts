import type { GoalCategory, QuarterBand } from '@app-types/api.types';

/** CGP goal categories and their share of the quarter score. */
export const GOAL_CATEGORY_LABELS: Record<GoalCategory, { label: string; share: number }> = {
  fundamental: { label: 'Fundamental', share: 50 },
  corporate: { label: 'Corporate', share: 25 },
  general: { label: 'General', share: 25 },
};

/** CGP bands: E3 85+, E2 70+, E1 50+, below 50. */
export const BAND_LOOK: Record<QuarterBand, { label: string; cls: string }> = {
  E3: { label: 'E3 · Exceptional', cls: 'bg-green-100 text-green-800' },
  E2: { label: 'E2 · Strong', cls: 'bg-emerald-50 text-emerald-700' },
  E1: { label: 'E1 · Meets expectations', cls: 'bg-amber-50 text-amber-700' },
  below: { label: 'Below expectations', cls: 'bg-red-50 text-red-700' },
};

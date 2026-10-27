import type { ScorecardRound } from '@app-types/api.types';

/**
 * The screening sheet from the company's scorecard Excel ("Template - Score
 * Card", Round 1) — a starting point the recruiter edits for the role.
 */
export const SCREENING_TEMPLATE: ScorecardRound['attributes'] = [
  {
    name: 'Experience Fitment',
    questions: [
      'Walk me through your career briefly — total experience, current role. Feel free to highlight achievements or milestones.',
    ],
  },
  {
    name: 'Domain Fitment',
    questions: [
      'What kind of projects have you worked on previously? Any in the electronics or hardware domain?',
    ],
  },
  {
    name: 'Qualifications and Certifications',
    questions: ["What's your educational background? Any certifications or courses?"],
  },
  {
    name: 'Role Understanding',
    questions: ['Have you read the JD? What 3 things about your background make you a strong fit for this role?'],
  },
  {
    name: 'Organizational Fitment',
    questions: [
      'Are you comfortable with an in-office role in Bangalore? (Yes / No)',
      'What draws you to a startup / smaller company setup vs a larger org?',
    ],
  },
  {
    name: 'Motivation',
    questions: ['Why are you considering a switch and why Elecbits specifically?'],
  },
  {
    name: 'Compensation & Availability',
    questions: [
      'What is your current and expected CTC, and what is your notice period? If the notice period is more than 1 month, is a buy-out possible?',
    ],
  },
  {
    name: 'Structured and Crystal-clear Communication',
    questions: ['Assessed throughout the call'],
  },
  { name: 'Clarity of Thought', questions: ['Assessed throughout the call'] },
  {
    name: 'Custom Question 1',
    questions: ['Based on resume / profile — gap, unusual role change, standout project.'],
  },
  {
    name: 'Custom Question 2',
    questions: ['Based on resume / profile — gap, unusual role change, standout project.'],
  },
];

/** The Excel's 20 / 30 / 50 for three rounds; other counts split evenly, the last round taking the rest. */
export const defaultRoundWeights = (n: number): number[] => {
  if (n === 3) return [20, 30, 50];
  if (n === 2) return [40, 60];
  if (n <= 1) return [100];
  const each = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? 100 - each * (n - 1) : each));
};

/** A round out of 100, as the Excel works it out: equal attribute shares, score/4 of each. */
export const roundScoreOf = (scores: number[]): number =>
  scores.length === 0
    ? 0
    : Math.round(scores.reduce((a, s) => a + (s / 4) * (100 / scores.length), 0) * 10) / 10;

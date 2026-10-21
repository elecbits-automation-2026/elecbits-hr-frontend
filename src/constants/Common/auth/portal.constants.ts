/**
 * Frontend surfaces (design doc §1). Unlike the XOR demo's three separate
 * front doors, the HRMS is ONE app for one org: every person is an Employee,
 * and the HR/Admin consoles are extra surfaces unlocked by the batches the
 * signed-in employee holds (the Venn overlap). HR is one console enclosing
 * its four portal sections — HRBP, TA, PR and OPS; holding any of those
 * batches unlocks /hr, and the sidebar filters to the sections held. These
 * constants name the sections; which ones render comes from GET /me's
 * `batches`.
 */
export const APP_SECTION = {
  employee: 'employee', // everyone: home, profile, my team, my assets, resignation
  hr: 'hr', // HRBP + TA + PR + OPS: people, org, hiring, payroll, exits, assets
  admin: 'admin', // Owner/SuperAdmin: batches, grant requests, audit log
} as const;

export type AppSection = (typeof APP_SECTION)[keyof typeof APP_SECTION];

/** Batch names that unlock each section (until a finer permission API lands). */
export const SECTION_BATCHES: Record<AppSection, string[] | null> = {
  employee: null, // null = every signed-in employee
  hr: ['HRBP', 'TA', 'PR', 'OPS'],
  admin: [], // empty = owner/superadmin flags on /me, not a batch
};

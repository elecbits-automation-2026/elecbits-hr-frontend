import type { Action, Scope } from '@app-types/api.types';

/**
 * Every grantable area in plain words for the Roles & access screens
 * (learner, 2026-11-05: "pretty technical — the users are more Admin and HR").
 * Keys mirror the backend's seeded module tree (scripts/seed-modules.ts); the
 * key never shows on screen. `hidden` = in the tree but no screen uses it yet,
 * so it is only shown when a role already has it.
 */
export const MODULE_INFO: Record<
  string,
  { label: string; group: string; unlocks: string; hidden?: boolean }
> = {
  'hrbp.people': {
    label: 'Employee records',
    group: 'HR',
    unlocks:
      'View: everyone’s profile. Add: new employees, one by one or from a sheet. Edit: change records, deactivate people, set goals, final approval on awards, people settings.',
  },
  'hrbp.org': {
    label: 'Departments & org chart',
    group: 'HR',
    unlocks: 'View: the department list and org chart (everyone has this). Add / Edit: create and change departments.',
  },
  'hrbp.policies': {
    label: 'Policies',
    group: 'HR',
    unlocks: 'Upload, update and retire policies; see who has acknowledged them.',
  },
  'hrbp.leaves': {
    label: 'Leave approvals',
    group: 'HR',
    unlocks: 'View: leave requests and balances. Edit: HR’s approval step on leave, and leave settings.',
  },
  'hrbp.attendance': {
    label: 'Attendance',
    group: 'HR',
    unlocks:
      'View: attendance and remote-work requests. Edit: mark days. Holidays and attendance settings need “Whole company”.',
  },
  'hrbp.exits': {
    label: 'Resignations & exits',
    group: 'HR',
    unlocks: 'Resignations, exits and HR’s exit clearance.',
  },
  'hrbp.grievances': {
    label: 'Concerns & open door',
    group: 'HR',
    unlocks:
      'Disputes passed up to HR and conduct complaints (anonymous ones need “Whole company”). Edit: offer open-door slots.',
  },
  'ta.hiring': {
    label: 'Hiring',
    group: 'Hiring',
    unlocks:
      'Every hiring line, JDs and scorecards, candidates and the talent pool, interviews and offers.',
  },
  'pr.payroll': {
    label: 'Payroll runs & payslips',
    group: 'Payroll',
    unlocks:
      'Build, check and finalise the monthly payroll; payslips and corrections; the payroll step on expense claims and the bank file; payroll settings. Remove: delete a draft run.',
  },
  'pr.payroll.compensation': {
    label: 'Salaries (CTC)',
    group: 'Payroll',
    unlocks: 'Salary / CTC records and the TDS calculator. Not part of “Payroll runs” — give it separately.',
  },
  'pr.payroll.bank_details': {
    label: 'Employee bank details',
    group: 'Payroll',
    unlocks: 'Bank name, account number and IFSC. Not part of “Salaries” — give it separately.',
  },
  'pr.payroll.compliance': {
    label: 'Compliance',
    group: 'Payroll',
    unlocks: 'Statutory compliance — not built yet.',
    hidden: true,
  },
  'ops.assets': {
    label: 'Asset register',
    group: 'Operations',
    unlocks:
      'Add and import assets, issue and lend them, take them back, move them between locations, record damage or loss.',
  },
  'ops.asset_requests': {
    label: 'Asset requests',
    group: 'Operations',
    unlocks: 'Pick up what people ask OPS for, decline, hand over or take back.',
  },
  'ops.gate_passes': {
    label: 'Gate passes',
    group: 'Operations',
    unlocks: 'Approve lab items leaving the office, decline, mark them back; late alerts.',
  },
  'ops.locations': {
    label: 'Asset categories',
    group: 'Operations',
    unlocks: 'Set up asset categories (lent items, gate pass needed).',
  },
  'ops.stock': {
    label: 'Stock',
    group: 'Operations',
    unlocks: 'Consumables per location: items, stock in, issue, move, adjust.',
  },
  'access.batches': {
    label: 'Roles & access',
    group: 'Admin',
    unlocks: 'Create and change roles, give or take them away, invite employees.',
  },
  'access.requests': {
    label: 'Access requests',
    group: 'Admin',
    unlocks: 'Approve or decline HR’s requests for someone’s access.',
  },
  'access.audit': { label: 'Audit log', group: 'Admin', unlocks: 'The history of every change.' },
  'access.settings': {
    label: 'All settings',
    group: 'Admin',
    unlocks: 'Change every setting in every area.',
  },
};

export const MODULE_GROUPS = ['HR', 'Payroll', 'Operations', 'Hiring', 'Admin', 'Other'] as const;

/** An area's name on screen: our label, else the seeded name, else the key. */
export const moduleLabel = (key: string, seededName?: string) =>
  MODULE_INFO[key]?.label ?? seededName ?? key;

/**
 * The built-in roles keep their stored names (the portal menus gate on them),
 * shown under a friendlier name and line. Custom roles show as named.
 */
export const ROLE_INFO: Record<string, { label: string; blurb: string }> = {
  Employee: {
    label: 'Everyone (basic)',
    blurb: 'Every employee has this: their own profile, leave, attendance and pay.',
  },
  HRBP: { label: 'HR team', blurb: 'Employee records, leave, attendance, policies, concerns and exits.' },
  TA: { label: 'Hiring team', blurb: 'Hiring lines, JDs and scorecards, candidates, interviews and offers.' },
  PR: { label: 'Payroll team', blurb: 'Monthly payroll, payslips, salaries, bank details and expense claims.' },
  OPS: {
    label: 'Operations / assets team',
    blurb: 'The asset register, asset requests, gate passes and stock.',
  },
};
export const roleLabel = (name: string) => ROLE_INFO[name]?.label ?? name;

export const ACTION_ORDER: Action[] = ['read', 'create', 'update', 'delete'];
export const ACTION_LABELS: Record<Action, string> = {
  read: 'View',
  create: 'Add',
  update: 'Edit',
  delete: 'Remove',
};

/**
 * Access levels: shortcuts that tick the action boxes (§4.1). Any other mix is
 * still a legal grant — it shows as "Custom".
 */
export const ACCESS_LEVELS: { key: string; label: string; actions: Action[] }[] = [
  { key: 'view', label: 'View only', actions: ['read'] },
  { key: 'view_add', label: 'View & add', actions: ['create', 'read'] },
  { key: 'edit', label: 'View, add & edit', actions: ['create', 'read', 'update'] },
  { key: 'full', label: 'Full control', actions: ['create', 'read', 'update', 'delete'] },
];

/** The level a set of ticked actions matches exactly, or null (custom). */
export const levelFor = (actions: Action[]): string | null => {
  const ticked = [...actions].sort().join(',');
  return ACCESS_LEVELS.find((l) => [...l.actions].sort().join(',') === ticked)?.key ?? null;
};

/** "View, add, edit" — the ticked actions in reading order. */
export const actionsText = (actions: Action[]) => {
  const words = ACTION_ORDER.filter((a) => actions.includes(a)).map((a) => ACTION_LABELS[a]);
  return words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(', ');
};

/**
 * "For whom" — every scope is enforced (refinement plan, Phase 3): it decides
 * WHOSE records the access reaches. Several on one area add up.
 */
export const SCOPE_ORDER: Scope[] = ['org', 'dept', 'team', 'team_direct', 'me'];
export const SCOPE_LABELS: Record<Scope, string> = {
  org: 'Whole company',
  dept: 'Their department',
  team: 'Everyone under them',
  team_direct: 'Their direct reports',
  me: 'Only themselves',
};

/**
 * Company-wide operations and configuration: only "Whole company" opens them;
 * a narrower one gives no access at all (holidays under attendance too).
 */
export const ORG_ONLY_MODULES = new Set([
  'pr.payroll',
  'pr.payroll.compensation',
  'pr.payroll.bank_details',
  'pr.payroll.compliance',
  'hrbp.org',
  'hrbp.policies',
  'ops.assets',
  'ops.locations',
  'ops.stock',
  'access.batches',
  'access.requests',
  'access.audit',
  'access.settings',
]);

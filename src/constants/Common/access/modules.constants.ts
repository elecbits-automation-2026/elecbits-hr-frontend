import type { Action, Scope } from '@app-types/api.types';

/**
 * What each grantable module unlocks, in plain words, for the batch composer.
 * Keys mirror the backend's seeded module tree (scripts/seed-modules.ts). A
 * module marked `notBuilt` exists in the tree but no screen uses it yet.
 */
export const MODULE_INFO: Record<string, { group: string; unlocks: string; notBuilt?: boolean }> = {
  'hrbp.people': {
    group: 'HR',
    unlocks:
      'People roster and person sheets (read); add employees and CSV import (create); edit records, deactivate, goals, R&R final approval, people settings (update).',
  },
  'hrbp.org': { group: 'HR', unlocks: 'Departments and the org chart.' },
  'hrbp.policies': {
    group: 'HR',
    unlocks: 'Policy library management, retire/restore, and the acknowledgement tracker.',
  },
  'hrbp.leaves': {
    group: 'HR',
    unlocks:
      'HR leave queue and the HR approval slot (update), leave balances on person sheets, leave settings.',
  },
  'hrbp.attendance': {
    group: 'HR',
    unlocks:
      'Attendance view, HR marks and the HR slot on remote work for the people the scope reaches; holidays and attendance settings need org scope.',
  },
  'hrbp.exits': { group: 'HR', unlocks: 'Exits and their clearances.' },
  'hrbp.grievances': {
    group: 'HR',
    unlocks:
      'Concerns: level-2 disputes and conduct complaints for the people the scope reaches (anonymous complaints need org scope); publish open-door slots (update).',
  },
  'hrbp.vigil': {
    group: 'HR',
    unlocks:
      'Whistleblower (vigil) reports — kept apart from routine HR; plain HR cannot see them. Org scope.',
  },
  'ta.hiring': {
    group: 'Hiring',
    unlocks:
      'Talent acquisition: every hiring line, JDs and scorecards, candidates and the talent pool, interview pipelines, offers. Org scope.',
  },
  'pr.payroll': {
    group: 'Payroll',
    unlocks:
      'Payroll runs and payslips (generate, edit drafts, finalize, mark paid), corrections, the payroll step on reimbursement claims, payroll settings, attendance CSV export. Org scope only.',
  },
  'pr.payroll.compensation': {
    group: 'Payroll',
    unlocks:
      'Salary/CTC records and the TDS calculator. Not included in pr.payroll — grant it separately.',
  },
  'pr.payroll.bank_details': {
    group: 'Payroll',
    unlocks:
      'Bank name, account number and IFSC on the compensation screen (read / update). Not included in compensation — grant it separately.',
  },
  'pr.payroll.compliance': { group: 'Payroll', unlocks: 'Statutory compliance.', notBuilt: true },
  'ops.assets': {
    group: 'Operations',
    unlocks:
      'The asset register: add / import, issue and lend, take back, hand over, move zones, statuses, incidents; told when lent items come back or run late. Org scope.',
  },
  'ops.asset_requests': {
    group: 'Operations',
    unlocks: 'The asset request queue: pick up, decline, fulfil (hand over / take back).',
  },
  'ops.gate_passes': {
    group: 'Operations',
    unlocks: 'Gate passes: approve (the item may leave), decline, mark back; overdue alerts.',
  },
  'ops.locations': {
    group: 'Operations',
    unlocks:
      'OPS setup: asset categories (lent / gate pass) and joiner kits. Locations themselves are the punch zones. Org scope.',
  },
  'ops.stock': {
    group: 'Operations',
    unlocks: 'Consumable stock per zone: items, stock in, issue, transfer, adjust. Org scope.',
  },
  'access.batches': { group: 'Admin', unlocks: 'Access batches and the Admin invite.' },
  'access.requests': { group: 'Admin', unlocks: 'The grant-request queue and decisions.' },
  'access.audit': { group: 'Admin', unlocks: 'The audit log.' },
  'access.settings': { group: 'Admin', unlocks: 'Every org setting, across all areas.' },
};

export const MODULE_GROUPS = ['HR', 'Payroll', 'Operations', 'Hiring', 'Admin', 'Other'] as const;

/**
 * Rights levels are an app-layer convenience (§4.1) — presets that tick the
 * action boxes. Any subset is a legal grant row, e.g. "editor minus create".
 */
export const RIGHTS_PRESETS: Record<string, Action[]> = {
  viewer: ['read'],
  contributor: ['create', 'read'],
  editor: ['create', 'read', 'update'],
  manager: ['create', 'read', 'update', 'delete'],
};

/** The preset a set of ticked actions matches exactly, or null (custom). */
export const presetFor = (actions: Action[]): string | null => {
  const ticked = [...actions].sort().join(',');
  for (const [name, preset] of Object.entries(RIGHTS_PRESETS)) {
    if ([...preset].sort().join(',') === ticked) return name;
  }
  return null;
};

/**
 * Every scope is enforced (refinement plan, Phase 3): it decides WHOSE rows a
 * grant reaches. Several scopes on one module add up.
 */
export const SCOPE_ORDER: Scope[] = ['org', 'dept', 'team', 'team_direct', 'me'];
export const SCOPE_LABELS: Record<Scope, string> = {
  org: 'org — whole company',
  dept: 'dept — their department',
  team: 'team — everyone below them',
  team_direct: 'team_direct — their direct reports',
  me: 'me — only themselves',
};

/**
 * Company-wide operations and configuration: only an org grant opens them; a
 * narrower one gives no access at all (holidays under hrbp.attendance too).
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

import {
  ADMIN_AUDIT_ROUTE,
  ADMIN_BATCHES_ROUTE,
  ADMIN_SEATS_ROUTE,
  ADMIN_GRANT_REQUESTS_ROUTE,
  ADMIN_INVITE_ROUTE,
  ADMIN_PUNCH_ZONES_ROUTE,
  ADMIN_SETTINGS_ROUTE,
  ADMIN_HIRING_APPROVALS_ROUTE,
  ADMIN_REIMBURSEMENTS_ROUTE,
  ADMIN_ROUTE,
  HOME_ROUTE,
  HR_ASSETS_ROUTE,
  HR_ASSET_REQUESTS_ROUTE,
  HR_DEPARTMENTS_ROUTE,
  HR_EXITS_ROUTE,
  HR_GATE_PASSES_ROUTE,
  HR_HIRING_ROUTE,
  HR_CANDIDATES_ROUTE,
  HR_ATTENDANCE_ROUTE,
  HR_LEAVES_ROUTE,
  HR_OPS_SETUP_ROUTE,
  HR_STOCK_ROUTE,
  HR_ORG_ROUTE,
  HR_PAYROLL_ROUTE,
  HR_PEOPLE_ROUTE,
  HR_ONBOARDING_ROUTE,
  HR_SETTINGS_ROUTE,
  HR_QUARTER_REPORTS_ROUTE,
  HR_POLICIES_ROUTE,
  GROWTH_ROUTE,
  GRIEVANCES_ROUTE,
  HIRING_APPROVALS_ROUTE,
  HIRING_INTERVIEWS_ROUTE,
  HIRING_JOINERS_ROUTE,
  HIRING_PLAN_ROUTE,
  ONBOARDING_ROUTE,
  PERFORMANCE_ROUTE,
  POLICIES_ROUTE,
  RECOGNITION_ROUTE,
  MY_ASSETS_ROUTE,
  MY_ATTENDANCE_ROUTE,
  MY_LEAVES_ROUTE,
  MY_PAYSLIPS_ROUTE,
  REIMBURSEMENTS_ROUTE,
  MY_TEAM_ROUTE,
  PROFILE_ROUTE,
} from './routes.constants';

export interface NavItem {
  label: string;
  to: string;
  /** Match the active state exactly (home) instead of by prefix. */
  end?: boolean;
  /** The employee menu's heading this item sits under. */
  group?: NavGroupKey;
}

/** Employee menu headings, in order (learner, 2026-11-05). */
export type NavGroupKey = 'me' | 'work' | 'team' | 'company' | 'hiring';
export const NAV_GROUP_LABEL: Record<NavGroupKey, string | null> = {
  me: null,
  work: 'Work',
  team: 'My team',
  company: 'Company',
  hiring: 'Hiring',
};

/** An HR item is visible only to holders of its portal's batch (§1) — or any of several. */
export type HrPortal = 'HRBP' | 'TA' | 'PR' | 'OPS';
export interface HrNavItem extends NavItem {
  portal: HrPortal | HrPortal[];
}

/**
 * The ONE navigation tree (design doc §1): everyone sees the Employee items;
 * the HR and Admin groups render nested in the same sidebar only for people
 * who can enter them, and HR filters to the portal batches held.
 * Owner/SuperAdmin see everything. PortalShell decides visibility via
 * utils/sections.ts — the same helper the route guard uses.
 */
export const EMPLOYEE_NAV: NavItem[] = [
  // Me (no heading)
  { label: 'Home', to: HOME_ROUTE, end: true, group: 'me' },
  { label: 'My profile', to: PROFILE_ROUTE, group: 'me' },
  { label: 'Attendance', to: MY_ATTENDANCE_ROUTE, group: 'me' },
  { label: 'Leave', to: MY_LEAVES_ROUTE, group: 'me' },
  { label: 'Pay', to: MY_PAYSLIPS_ROUTE, group: 'me' },
  { label: 'Expense claims', to: REIMBURSEMENTS_ROUTE, group: 'me' },
  { label: 'My equipment', to: MY_ASSETS_ROUTE, group: 'me' },
  // Shown only while it applies (me.showOnboarding) — PortalShell filters it.
  { label: 'Onboarding', to: ONBOARDING_ROUTE, group: 'me' },
  // Work
  { label: 'Goals & updates', to: PERFORMANCE_ROUTE, group: 'work' },
  { label: 'Career path', to: GROWTH_ROUTE, group: 'work' },
  { label: 'Awards', to: RECOGNITION_ROUTE, group: 'work' },
  // My team (RMs only — me.hasReports): People / Attendance / Leave tabs. The
  // old Team attendance and Team leaves pages are tabs inside it now.
  { label: 'My team', to: MY_TEAM_ROUTE, group: 'team' },
  // Company
  { label: 'Policies', to: POLICIES_ROUTE, group: 'company' },
  { label: 'Concerns & open door', to: GRIEVANCES_ROUTE, group: 'company' },
  // Hiring items show only to seat holders — PortalShell filters them.
  { label: 'Hiring plan', to: HIRING_PLAN_ROUTE, group: 'hiring' },
  { label: 'Hiring approvals', to: HIRING_APPROVALS_ROUTE, group: 'hiring' },
  { label: 'My interviews', to: HIRING_INTERVIEWS_ROUTE, group: 'hiring' },
  { label: 'Joiners', to: HIRING_JOINERS_ROUTE, group: 'hiring' },
  // Resign lives on My profile now (a link at the bottom), not in the menu.
];

/** Employee items that only make sense for an RM (filtered by hasReports). */
export const RM_ONLY_ROUTES: string[] = [MY_TEAM_ROUTE];
/** Shown only while onboarding applies to me or my joiners (me.showOnboarding). */
export const ONBOARDING_ROUTES: string[] = [ONBOARDING_ROUTE];

/** Hiring items: the plan for department heads, approvals for hiring approvers. */
export const HEAD_ONLY_ROUTES: string[] = [HIRING_PLAN_ROUTE];
export const HIRING_APPROVER_ROUTES: string[] = [HIRING_APPROVALS_ROUTE];
export const INTERVIEWER_ROUTES: string[] = [HIRING_INTERVIEWS_ROUTE];
/** The HRBP handover list — HRBP-batch holders only. */
export const HRBP_ONLY_ROUTES: string[] = [HIRING_JOINERS_ROUTE];

export const HR_NAV: HrNavItem[] = [
  { label: 'People', to: HR_PEOPLE_ROUTE, portal: 'HRBP' },
  { label: 'Org structure', to: HR_ORG_ROUTE, portal: 'HRBP' },
  { label: 'Departments', to: HR_DEPARTMENTS_ROUTE, portal: 'HRBP' },
  // HR accepts and clears, OPS clears assets, payroll works the F&F.
  { label: 'Exits', to: HR_EXITS_ROUTE, portal: ['HRBP', 'PR', 'OPS'] },
  { label: 'Leaves', to: HR_LEAVES_ROUTE, portal: 'HRBP' },
  { label: 'Attendance', to: HR_ATTENDANCE_ROUTE, portal: 'HRBP' },
  { label: 'Policies', to: HR_POLICIES_ROUTE, portal: 'HRBP' },
  { label: 'Onboarding', to: HR_ONBOARDING_ROUTE, portal: 'HRBP' },
  { label: 'Quarter reports', to: HR_QUARTER_REPORTS_ROUTE, portal: 'HRBP' },
  { label: 'Settings', to: HR_SETTINGS_ROUTE, portal: 'HRBP' },
  { label: 'Hiring', to: HR_HIRING_ROUTE, portal: 'TA' },
  { label: 'Candidates', to: HR_CANDIDATES_ROUTE, portal: 'TA' },
  { label: 'Payroll', to: HR_PAYROLL_ROUTE, portal: 'PR' },
  { label: 'Assets', to: HR_ASSETS_ROUTE, portal: 'OPS' },
  { label: 'Asset requests', to: HR_ASSET_REQUESTS_ROUTE, portal: 'OPS' },
  { label: 'Gate passes', to: HR_GATE_PASSES_ROUTE, portal: 'OPS' },
  { label: 'Stock', to: HR_STOCK_ROUTE, portal: 'OPS' },
  { label: 'OPS setup', to: HR_OPS_SETUP_ROUTE, portal: 'OPS' },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', to: ADMIN_ROUTE, end: true },
  { label: 'Invite employee', to: ADMIN_INVITE_ROUTE },
  { label: 'Roles & access', to: ADMIN_BATCHES_ROUTE },
  { label: 'Seats', to: ADMIN_SEATS_ROUTE },
  { label: 'Access requests', to: ADMIN_GRANT_REQUESTS_ROUTE },
  { label: 'Hiring approvals', to: ADMIN_HIRING_APPROVALS_ROUTE },
  { label: 'Reimbursements', to: ADMIN_REIMBURSEMENTS_ROUTE },
  { label: 'Punch zones', to: ADMIN_PUNCH_ZONES_ROUTE },
  { label: 'Org settings', to: ADMIN_SETTINGS_ROUTE },
  { label: 'Audit log', to: ADMIN_AUDIT_ROUTE },
];

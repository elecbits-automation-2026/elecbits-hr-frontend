import {
  ADMIN_AUDIT_ROUTE,
  ADMIN_BATCHES_ROUTE,
  ADMIN_GRANT_REQUESTS_ROUTE,
  ADMIN_INVITE_ROUTE,
  ADMIN_PUNCH_ZONES_ROUTE,
  ADMIN_SETTINGS_ROUTE,
  ADMIN_ROUTE,
  HOME_ROUTE,
  HR_ASSETS_ROUTE,
  HR_ASSET_REQUESTS_ROUTE,
  HR_DEPARTMENTS_ROUTE,
  HR_EXITS_ROUTE,
  HR_GATE_PASSES_ROUTE,
  HR_HIRING_ROUTE,
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
  RESIGNATION_ROUTE,
  TEAM_ATTENDANCE_ROUTE,
  TEAM_LEAVES_ROUTE,
} from './routes.constants';

export interface NavItem {
  label: string;
  to: string;
  /** Match the active state exactly (home) instead of by prefix. */
  end?: boolean;
}

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
  { label: 'Home', to: HOME_ROUTE, end: true },
  { label: 'My profile', to: PROFILE_ROUTE },
  { label: 'My team', to: MY_TEAM_ROUTE },
  { label: 'My assets', to: MY_ASSETS_ROUTE },
  { label: 'My leaves', to: MY_LEAVES_ROUTE },
  { label: 'My attendance', to: MY_ATTENDANCE_ROUTE },
  { label: 'My payslips', to: MY_PAYSLIPS_ROUTE },
  { label: 'Reimbursements', to: REIMBURSEMENTS_ROUTE },
  { label: 'Policies', to: POLICIES_ROUTE },
  { label: 'Onboarding', to: ONBOARDING_ROUTE },
  { label: 'Recognition', to: RECOGNITION_ROUTE },
  { label: 'My growth', to: GROWTH_ROUTE },
  { label: 'My performance', to: PERFORMANCE_ROUTE },
  { label: 'Grievances', to: GRIEVANCES_ROUTE },
  // Team items show only when me.hasReports — PortalShell filters them (UX
  // only; the backend returns empty team lists for non-RMs regardless).
  { label: 'Team leaves', to: TEAM_LEAVES_ROUTE },
  { label: 'Team attendance', to: TEAM_ATTENDANCE_ROUTE },
  { label: 'Resignation', to: RESIGNATION_ROUTE },
];

/** Employee items that only make sense for an RM (filtered by hasReports). */
export const RM_ONLY_ROUTES: string[] = [MY_TEAM_ROUTE, TEAM_LEAVES_ROUTE, TEAM_ATTENDANCE_ROUTE];

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
  { label: 'Access batches', to: ADMIN_BATCHES_ROUTE },
  { label: 'Grant requests', to: ADMIN_GRANT_REQUESTS_ROUTE },
  { label: 'Punch zones', to: ADMIN_PUNCH_ZONES_ROUTE },
  { label: 'Org settings', to: ADMIN_SETTINGS_ROUTE },
  { label: 'Audit log', to: ADMIN_AUDIT_ROUTE },
];

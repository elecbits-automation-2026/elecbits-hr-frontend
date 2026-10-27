/**
 * API response types, mirroring the backend's documented Zod schemas. These
 * are maintained by hand until the OpenAPI doc (/docs.json) is fed into a
 * generator — keep field-for-field parity with the backend `*.schema.ts`.
 */

export type Level = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
export type Scope = 'me' | 'team_direct' | 'team' | 'dept' | 'org';
export type Action = 'create' | 'read' | 'update' | 'delete';

export interface Session {
  accessToken: string;
  user: { id: string; email: string; employeeId: string };
}

/** A person link resolved for display (RM, approvers). */
export type PersonRef = { id: string; name: string; employeeCode: string } | null;

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string;
  level: Level;
  status: 'invited' | 'active' | 'exiting' | 'inactive';
  departmentId: string | null;
  reportsTo: string | null;
  // Overview (self-serve identity).
  salutation: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  // Company details (org-controlled).
  designation: string | null;
  employmentType: string | null;
  // Joining (org-controlled).
  dateOfJoining: string | null;
  confirmationDate: string | null;
  noticeDays: number | null;
  offerDate: string | null;
  // Contacts & address (self-serve).
  personalEmail: string | null;
  preferredContactEmail: 'company' | 'personal' | null;
  unsubscribed: boolean;
  currentAddress: string | null;
  permanentAddress: string | null;
  // Resolved org links.
  department: { id: string; name: string } | null;
  baseZone: { id: string; name: string } | null;
  manager: PersonRef;
  expenseApprover: PersonRef;
  shiftRequestApprover: PersonRef;
  leaveApprover: PersonRef;
  batches: string[];
  isOwner: boolean;
  isSuperadmin: boolean;
  /** Anyone routes to this person as RM or leave approver (Team-leaves nav). */
  hasReports: boolean;
  /** Reports to the Admin account: own requests self-approve, sets own goals. */
  selfGoverned: boolean;
  /** Seats held right now — shows the hiring nav items (UX only). */
  seats: SeatKind[];
  /** The HR department's head, or a TA RM with a hire to decide — shows Hiring approvals (UX only). */
  hiringApprover: boolean;
  /** Conducts a round on a live application — shows My interviews (UX only). */
  hasInterviews: boolean;
}

/** PATCH /me body — self-serve identity fields only (decision D3). */
export interface UpdateMeInput {
  salutation?: string | null;
  firstName?: string;
  middleName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  personalEmail?: string | null;
  preferredContactEmail?: 'company' | 'personal' | null;
  unsubscribed?: boolean;
  currentAddress?: string | null;
  permanentAddress?: string | null;
}

/**
 * GET /me/salary — ME SCOPED: served only for the caller themselves; Payroll
 * reads others' via /employees/:id/salary (pr.payroll.compensation).
 */
export interface EmployeeSalary {
  ctc: string | null;
  payrollCostCenter: string | null;
  salaryCurrency: string;
  salaryMode: string | null;
  panNumber: string | null;
  providentFundAccount: string | null;
  employeeAdvanceAccount: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  ifscCode: string | null;
  // Structure (% of monthly gross; defaults 50/20) + recurring deductions.
  basicPercent: string | null;
  hraPercent: string | null;
  pfAmount: string | null;
  tdsAmount: string | null;
  professionalTaxAmount: string | null;
  otherDeductionAmount: string | null;
  /** CNPS % of the basic share — feeds the TDS calculator. */
  cnpsPercent: string | null;
  /**
   * Payroll's view only: true when the caller lacks pr.payroll.bank_details —
   * the bank fields then come back null and must not be sent back.
   */
  bankDetailsHidden?: boolean;
  /** Annual variable-pay target (payroll view only). */
  variablePay?: string | null;
}

/** PUT /employees/:id/salary — every field optional; null clears it. */
export interface UpdateEmployeeSalaryInput {
  ctc?: string | null;
  payrollCostCenter?: string | null;
  salaryCurrency?: string;
  salaryMode?: string | null;
  panNumber?: string | null;
  providentFundAccount?: string | null;
  employeeAdvanceAccount?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  ifscCode?: string | null;
  basicPercent?: string | null;
  hraPercent?: string | null;
  pfAmount?: string | null;
  tdsAmount?: string | null;
  professionalTaxAmount?: string | null;
  otherDeductionAmount?: string | null;
  cnpsPercent?: string | null;
  variablePay?: string | null;
}

// ── Payroll ────────────────────────────────────────────────────────────────

export type PayrollRunStatus = 'draft' | 'finalized' | 'paid';

export interface PayrollRun {
  id: string;
  month: string;
  status: PayrollRunStatus;
  payslipCount: number;
  netTotal: number;
  createdAt: string;
  finalizedAt: string | null;
  paidAt: string | null;
}

export interface Payslip {
  id: string;
  runId: string;
  employee: { id: string; name: string; employeeCode: string };
  // No `ctc`: annual compensation stays behind pr.payroll.compensation (M6).
  currency: string;
  /** The Basic / HRA split (% of the prorated month), from the salary record. */
  basicPercent: number;
  hraPercent: number;
  /** ERP-sheet model: CTC/12, prorated over a fixed 30-day base. */
  monthlyGross: number;
  basic: number;
  hra: number;
  lta: number;
  specialAllowance: number;
  workingDays: number;
  lopDays: number;
  lopAmount: number;
  /** Absence auto-covered from the earned balance at month end. */
  autoElDays: number;
  autoSlDays: number;
  autoClDays: number;
  lopOverridden: boolean;
  /** PF (both sides) and PT are computed by the engine — read-only. */
  pf: number;
  pfEmployer: number;
  tds: number;
  professionalTax: number;
  otherDeduction: number;
  healthInsurance: number;
  cnpsEmployer: number;
  reimbursement: number;
  performanceBonus: number;
  /** Approved R&R awards from the previous month (read-only). */
  recognitionBonus: number;
  otherBonus: number;
  leaveEncashment: number;
  advance: number;
  /** Full & final (exit module): set only on the slip that settles an exit. */
  exitId: string | null;
  encashedElDays: number;
  gratuityYears: number;
  gratuity: number;
  noticePay: number;
  noticeRecovery: number;
  sickLopDays: number;
  sickLopDeduction: number;
  fnfRecovery: number;
  /** Loan / advance EMIs this month (the whole balance on an F&F slip). */
  loanEmi: number;
  earningsTotal: number;
  deductionsTotal: number;
  netPay: number;
  /** The approved claims behind `reimbursement`. */
  reimbursementClaims: Array<{
    id: string;
    spentOn: string;
    category: string;
    description: string;
    amount: number;
  }>;
  /** Signed total of corrections to earlier slips carried by this one. */
  correction: number;
  /** The PT state the slip was taxed under (null = no PT). */
  ptState: string | null;
  /** The corrections behind `correction` (pending ones while a draft). */
  corrections: Array<{ id: string; sourceMonth: string; amount: number; reason: string }>;
  /** Corrections recorded AGAINST this slip, and the month that pays each. */
  correctedBy: Array<{
    id: string;
    amount: number;
    reason: string;
    status: PayslipCorrectionStatus;
    appliedMonth: string | null;
  }>;
  /** Net + reimbursement/bonuses/encashment/advance + correction — what gets paid. */
  finalPay: number;
}

// ── Reimbursement claims ─────────────────────────────────────────────────────

export type ReimbursementStatus =
  | 'pending_rm'
  | 'pending_payroll'
  | 'approved'
  | 'paid'
  | 'declined'
  | 'cancelled';

export interface ReimbursementClaim {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  spentOn: string;
  category: 'travel' | 'food' | 'internet_phone' | 'equipment' | 'other';
  description: string;
  amount: number;
  receiptNote: string | null;
  /** The uploaded receipt file, if any. */
  receipt: { fileName: string; uploadedAt: string } | null;
  status: ReimbursementStatus;
  rmDecidedByName: string | null;
  rmDecidedAt: string | null;
  payrollDecidedByName: string | null;
  payrollDecidedAt: string | null;
  declineReason: string | null;
  /** YYYY-MM of the payroll run that paid it. */
  paidInMonth: string | null;
  createdAt: string;
}

export interface CreateReimbursementInput {
  spentOn: string;
  category: ReimbursementClaim['category'];
  description: string;
  amount: number;
  receiptNote?: string;
}

export type PayslipCorrectionStatus = 'pending' | 'applied' | 'cancelled';

/** A post-finalize correction as the PR console lists it. */
export interface PayslipCorrection {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  sourcePayslipId: string;
  sourceMonth: string;
  /** + pays more, − recovers. */
  amount: number;
  reason: string;
  status: PayslipCorrectionStatus;
  appliedMonth: string | null;
  createdByName: string;
  createdAt: string;
}

export interface MyPayslip extends Payslip {
  month: string;
  runStatus: PayrollRunStatus;
}

export interface GenerateRunResult {
  run: PayrollRun;
  payslips: Payslip[];
  skipped: Array<{ id: string; name: string; employeeCode: string }>;
}

export interface UpdatePayslipInput {
  lopDays?: number;
  tds?: number;
  otherDeduction?: number;
  healthInsurance?: number;
  cnpsEmployer?: number;
  performanceBonus?: number;
  otherBonus?: number;
  leaveEncashment?: number;
  advance?: number;
}

/** GET /me/assets — an asset currently in the caller's custody. */
export interface MyAsset {
  id: string;
  assetCode: string;
  name: string;
  category: string | null;
  status: AssetStatus;
}

/** GET /me/exit — the caller's own exit record, if any. */
export interface MyExit {
  id: string;
  kind: ExitKind;
  status: ExitStatus;
  noticeStartOn: string;
  lastWorkingDay: string;
  interviewAt: string | null;
  settledAt: string | null;
}

export type EmploymentType = 'intern' | 'permanent' | 'contract';

export interface Employee {
  id: string;
  name: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  phone: string | null;
  employeeCode: string;
  email: string;
  departmentId: string | null;
  /** The department's name (list / get / incomplete records). */
  departmentName?: string | null;
  level: Level;
  reportsTo: string | null;
  status: 'invited' | 'active' | 'exiting' | 'inactive';
  baseZoneId: string | null;
  designation: string | null;
  employmentType: string | null;
  dateOfJoining: string | null;
  offerDate: string | null;
  confirmationDate: string | null;
  noticeDays: number | null;
  /** Personal workday (HH:mm) overriding the base zone; null = zone/org hours. */
  workStart: string | null;
  workEnd: string | null;
  createdAt: string;
}

/** POST /employees body — mirrors the backend's strict createEmployeeSchema. */
export interface CreateEmployeeInput {
  /** Personal workday pair (HH:mm); null clears it. */
  workStart?: string | null;
  workEnd?: string | null;
  firstName: string;
  middleName?: string;
  lastName?: string;
  email: string;
  employeeCode: string;
  phone?: string;
  departmentId?: string;
  baseZoneId?: string;
  level: Level;
  reportsTo: string;
  status?: 'active' | 'inactive';
  designation?: string;
  employmentType?: EmploymentType;
  dateOfJoining?: string;
  offerDate?: string;
  confirmationDate?: string;
  noticeDays?: number;
}

/** POST /employees/invite body — the Admin access-first door (D1–D4). */
export interface InviteEmployeeInput {
  email: string;
  name: string;
  reportsTo: string;
  baseZoneId?: string;
  level: Level;
  batchIds: string[];
  dateOfJoining?: string;
  departmentId?: string;
  designation?: string;
}

// ── Leaves — dual approval (RM + HRBP, any order) ──────────────────────────

/** Raisable types per the leave policy v1; `casual` survives only in history. */
export type LeaveType =
  | 'sick'
  | 'earned'
  | 'menstrual'
  | 'vacation_family'
  | 'compassionate'
  | 'unpaid'
  | 'casual';
export type LeaveDayPart = 'full' | 'first_half' | 'second_half';
export type LeaveStatus =
  | 'pending'
  | 'partially_approved'
  | 'approved'
  | 'declined'
  | 'cancelled';

export interface LeaveRequest {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  type: LeaveType;
  startDate: string;
  endDate: string;
  dayPart: LeaveDayPart;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  rmRequired: boolean;
  /** False when the requester is an HRBP — their RM's approval suffices. */
  hrRequired: boolean;
  rmApprovedBy: string | null;
  rmApprovedAt: string | null;
  hrApprovedBy: string | null;
  hrApprovedAt: string | null;
  /** Names behind the filled slots — the queues show WHO approved. */
  rmApprovedByName: string | null;
  hrApprovedByName: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
  /** Exit module: 3+ sick days during notice need a certificate, or they're LOP in the F&F. */
  certificateNeeded: boolean;
  certificate: { fileName: string; uploadedAt: string } | null;
  createdAt: string;
}

/**
 * `allocated`/`remaining` are null for uncapped types (unpaid). `allocated`
 * is the ACCRUED-TO-DATE grant for earned/menstrual; `opening` is earned's
 * carry-forward — `remaining` already applies the 30-day effective cap.
 */
export interface LeaveBalance {
  type: LeaveType;
  year: number;
  allocated: number | null;
  opening: number;
  used: number;
  remaining: number | null;
}

export interface CreateLeaveRequestInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  dayPart?: LeaveDayPart;
  reason?: string;
}

export interface DecideLeaveInput {
  decision: 'approve' | 'decline';
  reason?: string;
}

// ── Attendance ─────────────────────────────────────────────────────────────

export type AttendanceDayStatus =
  | 'none'
  | 'weekend'
  | 'holiday'
  | 'leave'
  | 'half_leave'
  | 'wfh'
  | 'present'
  | 'half_day' // punched in, never out — auto-closed as half day
  | 'absent';

export interface PunchZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Zone working hours; null = company default. */
  workStart: string | null;
  workEnd: string | null;
}
export type AttendanceSource = 'office' | 'remote' | 'regularized';
export type ApprovalStatus =
  | 'pending'
  | 'partially_approved'
  | 'approved'
  | 'declined'
  | 'cancelled';

/** Punctuality vs the official workday (the calendar's corner dots).
 *  'compensated' = came late (or left early) but worked the full scheduled
 *  hours — both dots render purple. */
export type CheckInTiming = 'ontime' | 'grace' | 'late' | 'compensated';
export type CheckOutTiming = 'ontime' | 'grace' | 'early' | 'compensated';

export interface AttendanceDay {
  date: string;
  status: AttendanceDayStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  source: AttendanceSource | null;
  workedHours: number | null;
  holidayName: string | null;
  leaveType: string | null;
  checkInTiming: CheckInTiming | null;
  checkOutTiming: CheckOutTiming | null;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  leave: number;
  wfh: number;
  holiday: number;
  weekend: number;
  lateIns: number;
  earlyOuts: number;
}

export interface MyAttendance {
  month: string;
  days: AttendanceDay[];
  summary: AttendanceSummary;
  today: {
    date: string;
    checkedIn: boolean;
    checkedOut: boolean;
    checkInAt: string | null;
    checkOutAt: string | null;
    source: AttendanceSource | null;
    checkInTiming: CheckInTiming | null;
    checkOutTiming: CheckOutTiming | null;
  } | null;
}

export interface EmployeeAttendance {
  employee: { id: string; name: string; employeeCode: string };
  days: AttendanceDay[];
  summary: AttendanceSummary;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface Regularization {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  date: string;
  proposedIn: string;
  proposedOut: string;
  reason: string | null;
  status: ApprovalStatus;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: string;
}

export type RemoteWorkType = 'wfh' | 'client_visit' | 'remote';

export interface WfhRequest {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  type: RemoteWorkType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: ApprovalStatus;
  rmApprovedBy: string | null;
  hrApprovedBy: string | null;
  /** Names behind the filled slots — the queues show WHO approved. */
  rmApprovedByName: string | null;
  hrApprovedByName: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface Grant {
  moduleKey: string;
  action: Action;
  scope: Scope;
}

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  grants: Grant[];
  createdAt: string;
}

/** The single-use claim link payload — the token is shown exactly once. */
export interface ClaimInfo {
  token: string;
  expiresAt: string;
}

/** Create/invite responses carry the one-time claim token for the link. */
export type EmployeeWithClaim = Employee & { claim?: ClaimInfo };

/** One person in the caller's chain — sanitized (no salary/personal data). */
export interface TeamMember {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  baseZone: string | null;
  relation: 'report' | 'approver_only';
  /** Not-yet-active people show a status tag instead of an attendance chip. */
  status: 'invited' | 'active' | 'exiting';
  /** For the person sheet: tenure + band badge. Still no pay, no personal data. */
  level: Level;
  dateOfJoining: string | null;
}

// ── Feedback notes (insights phase C) ──────────────────────────────────────

export type FeedbackType = 'appreciation' | 'concern';

/** Drafted by the system from evidence, reviewed and sent by a human. */
export interface FeedbackNote {
  id: string;
  employee: { id: string; name: string };
  author: { id: string; name: string };
  type: FeedbackType;
  body: string;
  evidence: string | null;
  createdAt: string;
}

export interface CreateFeedbackInput {
  employeeId: string;
  type: FeedbackType;
  body: string;
  evidence?: string;
}

/** A seeded access module — what the batch composer offers to grant on. */
export interface Module {
  key: string;
  name: string;
  parentKey: string | null;
}

export interface BatchHolder {
  employeeId: string;
  name: string;
  employeeCode: string;
  email: string;
  grantedBy: string | null;
  grantedAt: string;
}

/** One unit of access in a request: a whole batch, or a single grant tuple. */
export interface GrantRequestItem {
  kind: 'batch' | 'grant';
  batchId?: string;
  moduleKey?: string;
  action?: string;
  scope?: string;
  /** Display name for batch items. */
  batchName?: string | null;
}

/** HR asks for one person; Admin approves, narrows or declines (§5.5). */
export interface GrantRequest {
  id: string;
  employee: { id: string; name: string };
  requestedBy: { id: string; name: string };
  note: string | null;
  status: 'pending' | 'approved' | 'approved_narrower' | 'declined' | 'cancelled';
  requested: GrantRequestItem[];
  granted: GrantRequestItem[];
  decidedBy: { id: string; name: string } | null;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface RequestableBatch {
  id: string;
  name: string;
  description: string | null;
}

export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  subject: string;
  detail: string | null;
  createdAt: string;
}

// ── Policies (version-bound acknowledgements) ───────────────────────────────

export type PolicyCategory =
  | 'conduct'
  | 'handbook'
  | 'performance'
  | 'time'
  | 'culture'
  | 'other';

/** ok = signed the current version; stale = signed an older one; none = never. */
export type PolicyAckState = 'ok' | 'stale' | 'none';

export interface Policy {
  id: string;
  code: string;
  title: string;
  category: PolicyCategory;
  version: string;
  ackRequired: boolean;
  summary: string | null;
  docUrl: string | null;
  /** True when the PDF is stored in our DB — open via policiesApi.openDocument. */
  hasDocument: boolean;
  effectiveFrom: string | null;
  /** Set = retired: out of the library and tracker, not signable; HR can restore. */
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A policy + the caller's own acknowledgement state. */
export interface MyPolicy extends Policy {
  ack: {
    state: PolicyAckState;
    ackedVersion: string | null;
    ackedAt: string | null;
  };
}

export interface CreatePolicyInput {
  code: string;
  title: string;
  category: PolicyCategory;
  version: string;
  ackRequired: boolean;
  summary?: string;
  docUrl?: string;
  effectiveFrom?: string;
}

export interface UpdatePolicyInput {
  title?: string;
  category?: PolicyCategory;
  version?: string;
  ackRequired?: boolean;
  summary?: string | null;
  docUrl?: string | null;
  effectiveFrom?: string | null;
}

export interface PolicyAckResult {
  policyId: string;
  version: string;
  ackedAt: string;
}

/** HR grid: people × ack-required policies. */
export interface PolicyTracker {
  policies: Policy[];
  rows: Array<{
    employee: { id: string; name: string; employeeCode: string };
    cells: Array<{
      policyId: string;
      state: PolicyAckState;
      ackedVersion: string | null;
      ackedAt: string | null;
    }>;
  }>;
}

// ── Onboarding journeys ─────────────────────────────────────────────────────

export type OnboardingPhase = 'before_start' | 'week_one' | 'first_30';
export type OnboardingTaskOwner = 'employee' | 'hr' | 'manager' | 'admin' | 'ops' | 'payroll';

/** An OPS / payroll joiner task (kit issue, salary + bank on record). */
export interface OnboardingTeamTask {
  taskId: string;
  title: string;
  done: boolean;
  /** Done by the system: the kit is all held / salary + bank are on record. */
  autoDone: boolean;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    designation: string | null;
    dateOfJoining: string | null;
  };
}

export interface OnboardingTask {
  id: string;
  seq: number;
  phase: OnboardingPhase;
  taskKey: string;
  title: string;
  owner: OnboardingTaskOwner;
  /** Set on policy-linked steps — completed via the policy ack, never ticked. */
  policyCode: string | null;
  policyId: string | null;
  done: boolean;
  doneAt: string | null;
  doneByName: string | null;
}

export interface OnboardingJourney {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  startedOn: string;
  dueOn: string;
  status: 'open' | 'done';
  progress: { done: number; total: number };
  tasks: OnboardingTask[];
}

export interface OnboardingQueueRow {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  startedOn: string;
  dueOn: string;
  status: 'open' | 'done';
  progress: { done: number; total: number };
  /** Days until dueOn; negative = overdue. */
  daysLeft: number;
}

export interface StartOnboardingInput {
  employeeId: string;
  startedOn?: string;
}

// ── Recognitions (R&R) ──────────────────────────────────────────────────────

/** An award-catalog key — HR edits the catalog in settings and can add types. */
export type AwardType = string;
export type RecognitionStatus = 'pending' | 'approved' | 'declined';

export interface Recognition {
  id: string;
  /** This row's recipient; a team award lists everyone in `recipients`. */
  employee: { id: string; name: string };
  recipients: Array<{ id: string; name: string }>;
  groupId: string | null;
  type: AwardType;
  /** Catalog name at nomination (a snapshot). */
  awardName: string;
  citation: string;
  valueInr: number;
  nominatedBy: { id: string; name: string };
  status: RecognitionStatus;
  cycle: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface RecognitionBoard {
  ranking: Array<{
    employee: { id: string; name: string };
    count: number;
    totalInr: number;
    byType: Record<AwardType, number>;
  }>;
  recent: Recognition[];
  /** Award key -> display name, for per-type badges. */
  typeNames: Record<AwardType, string>;
}

/** One award type nominators can pick. */
export interface RecognitionAward {
  key: AwardType;
  name: string;
  cadence: 'any' | 'monthly' | 'quarterly';
  valueInr: number;
  /** May name several people; the value is split equally. */
  team: boolean;
}

/** Sanitized name list for pickers — names unlock no records. */
export interface DirectoryEntry {
  id: string;
  name: string;
  employeeCode: string;
  designation: string | null;
}

/** GET /payroll/people — who payroll may put on payroll (invited included). */
export interface CompensationPerson {
  id: string;
  name: string;
  employeeCode: string;
  status: 'invited' | 'active' | 'exiting';
}

export interface CreateRecognitionInput {
  employeeIds: string[];
  type: AwardType;
  citation: string;
}

export interface DecideRecognitionInput {
  decision: 'approve' | 'decline';
  reason?: string;
}

// ── Career ladder & roadmap ─────────────────────────────────────────────────

export interface Band {
  code: Level;
  name: string;
  next: Level | null;
  expects: string;
}

export interface CareerTrack {
  id: string;
  employeeId: string;
  bandCode: Level;
  targetBand: Level;
  note: string | null;
  openedByName: string | null;
  status: 'open' | 'met' | 'closed';
  closeReason: string | null;
  closedAt: string | null;
  createdAt: string;
}

/** One band change on record (written when HR edits the level). */
export interface LevelChange {
  from: Level;
  to: Level;
  at: string;
  byName: string | null;
  /** The roadmap this change fulfilled, if one was open. */
  trackId: string | null;
}

export interface CareerTrackNote {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

export interface MyCareer {
  ladder: Band[];
  current: Level;
  next: Level | null;
  /** Derived from the record — nothing on this card can be typed into. */
  evidence: {
    punchedDays30: number;
    recognitions: number;
    appreciationNotes: number;
    /** This quarter's weighted goal attainment; null with no goals. */
    quarter: { name: string; attainment: number | null };
  };
  track: CareerTrack | null;
  /** Notes on the open track, oldest first. */
  notes: CareerTrackNote[];
  /** Band changes, oldest first. */
  history: LevelChange[];
  /** Whether the employee may ask for the conversation themselves, and why not. */
  selfRequest: {
    allowed: boolean;
    blockers: string[];
    inBandSince: string | null;
    lastQuarter: { name: string; attainment: number | null };
  };
}

/** One person's career for their RM or HR. */
export interface PersonCareer {
  current: Level;
  next: Level | null;
  track: CareerTrack | null;
  notes: CareerTrackNote[];
  history: LevelChange[];
}

export interface TeamCareerRow {
  employee: { id: string; name: string; employeeCode: string };
  level: Level;
  recognitions: number;
  lastRecognizedAt: string | null;
  track: CareerTrack | null;
}

export interface OpenCareerTrackInput {
  employeeId: string;
  targetBand?: Level;
  note?: string;
}

// ── TDS calculator (ERP sheet, "TDS" tab) ───────────────────────────────────

export interface TdsEstimate {
  employee: { id: string; name: string; employeeCode: string };
  ctc: number;
  dateOfJoining: string | null;
  fyClose: string;
  fyMonths: number;
  payrollMonthsRemaining: number;
  cnpsPercent: number;
  fyCtc: number;
  cnpsAmount: number;
  stdDeduction: number;
  employerPfAnnual: number;
  /** Annual variable-pay target (0 when unset). */
  variablePay: number;
  /** Its FY share — part of taxable income. */
  fyVariablePay: number;
  taxableIncome: number;
  /** Surcharge above ₹50L, before cess (marginal relief applied). */
  surcharge: number;
  /** (New-regime slabs + surcharge) × 1.04 cess; zero up to the 12L rebate line. */
  totalTax: number;
  tdsPerMonth: number;
  tdsAlreadyDeducted: number;
  /** (totalTax − already) ÷ months left — what to apply going forward. */
  revisedTdsPerMonth: number;
  /** What drafts currently pick up (employee_salary.tds_amount). */
  currentTdsAmount: number;
}

export interface UpdateTdsInput {
  tdsAmount?: number;
  cnpsPercent?: number;
}

/** Inputs for the salary annexure (offer breakup) calculator. */
export interface AnnexureInput {
  /** ANNUAL CTC in ₹. */
  ctc: number;
  /** The PT state from payroll.ptStates; omitted = no PT. */
  ptState?: string;
  /** ANNUAL variable-pay target — joins taxable income. */
  variablePay: number;
  healthInsurance: number;
  cnpsPercent: number;
  /** The structure split (defaults 50 / 25). */
  basicPercent?: number;
  hraPercent?: number;
}

/**
 * Offer breakup computed by the SAME engine as the payslip (blended PF, PT,
 * full-year TDS with marginal relief) — the offer matches month one.
 */
export interface SalaryAnnexure {
  ctcAnnual: number;
  ctcMonthly: number;
  basic: number;
  hra: number;
  lta: number;
  specialAllowance: number;
  grossSalary: number;
  pfEmployee: number;
  pfEmployer: number;
  professionalTax: number;
  healthInsurance: number;
  cnpsEmployer: number;
  variablePayAnnual: number;
  taxableIncome: number;
  surchargeAnnual: number;
  totalTaxAnnual: number;
  tdsPerMonth: number;
  /** After PF both sides, PT, TDS, health insurance and CNPS — the bank figure. */
  netTakeHome: number;
}

// ── Performance: weighted goals + daily work updates ────────────────────────

export interface ReviewCycle {
  id: string;
  /** '2026-Q4' — ensured lazily, one row per quarter. */
  name: string;
  startDate: string;
  endDate: string;
}

/** CGP goal categories — the quarter score weighs them 50 / 25 / 25. */
export type GoalCategory = 'fundamental' | 'corporate' | 'general';

export interface Goal {
  id: string;
  employeeId: string;
  cycleId: string;
  title: string;
  category: GoalCategory;
  metric: string | null;
  target: string | null;
  weight: number;
  /** 0–100, moved ONLY by the goal's owner. */
  progress: number;
  dueOn: string;
  /** Set = a hiring goal: progress follows the position in Hiring; not editable here. */
  positionId: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface MyGoals {
  cycle: ReviewCycle;
  goals: Goal[];
  /** 50% Fundamental + 25% Corporate + 25% General — null until a goal exists. */
  attainment: number | null;
  byCategory: Record<GoalCategory, number | null>;
  atRisk: number;
  /** Weights should sum to 100 — the UI warns, nothing blocks. */
  weightTotal: number;
}

export interface CreateGoalInput {
  employeeId: string;
  title: string;
  category?: GoalCategory;
  metric?: string;
  target?: string;
  weight: number;
  /** Defaults to the cycle's end date. */
  dueOn?: string;
}

export interface TeamGoalsRow {
  employee: { id: string; name: string; employeeCode: string };
  goalCount: number;
  attainment: number | null;
  atRisk: number;
}

export interface WorkUpdate {
  id: string;
  date: string;
  note: string;
  /** 0–100 alignment with OWN goals; null = unscored, NEVER 0 on failure. */
  score: number | null;
  feedback: string | null;
  kpiHits: string[] | null;
  /** Own goals this update is tagged with. */
  goalIds: string[] | null;
  /** null = written on the day; otherwise a late entry for a missed day. */
  lateStatus: 'pending' | 'approved' | 'declined' | null;
  createdAt: string;
  updatedAt: string;
}

/** One day of the update strip, classified by the server. */
export type StripStatus =
  | 'done'
  | 'missed'
  | 'late_pending'
  | 'late_approved'
  | 'leave'
  | 'holiday'
  | 'weekend'
  | 'today'
  | 'not_joined';

/** A late entry waiting for the RM. */
export interface LateWorkUpdate {
  employee: { id: string; name: string };
  update: WorkUpdate;
}

export interface UpdateGoalInput {
  title?: string;
  category?: GoalCategory;
  metric?: string | null;
  target?: string | null;
  weight?: number;
  dueOn?: string;
}

export interface MyWorkUpdates {
  updates: WorkUpdate[];
  scoringEnabled: boolean;
  /** Oldest first, today last. */
  strip: Array<{ date: string; status: StripStatus }>;
  missesThisMonth: number;
  missAllowance: number;
  /** Days back a missed update can still be filled in. */
  lateWindowDays: number;
}

export interface TeamUpdatesRow {
  employee: { id: string; name: string; employeeCode: string };
  updates: WorkUpdate[];
  missesThisMonth: number;
  overAllowance: boolean;
}

/** Settings area — its owning module (or access.settings) governs the key. */
export type SettingArea = 'payroll' | 'attendance' | 'leaves' | 'people' | 'ops' | 'access';

/**
 * One org-tunable setting. `value`'s shape depends on the key — the backend
 * registry validates it; the settings components have an editor per shape.
 */
export interface OrgSetting {
  key: string;
  area: SettingArea;
  label: string;
  description: string;
  /** False until a feature reads the key — editing it changes nothing yet. */
  live: boolean;
  /** The caller may change it (area module or access.settings update). */
  canEdit: boolean;
  value: unknown;
  /** True when no override exists — the code default is in effect. */
  isDefault: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** GET /settings/public — values employee-side hints read; any may be absent. */
export interface PublicSettings {
  'attendance.workHours'?: { workStart: string; workEnd: string; graceMinutes: number };
  'leaves.applicationWindowDays'?: { earned: number; vacation_family: number };
  'attendance.workWeek'?: {
    saturdays: 'all_working' | 'all_off' | 'first_third_off';
    effectiveFrom?: string;
  };
  'concerns.icContact'?: { contact: string };
}

export interface AwardCatalogEntry {
  name: string;
  cadence: 'any' | 'monthly' | 'quarterly';
  valueInr: number;
  /** May go to several people; the value is split equally. */
  team?: boolean;
}

/** One bell notification — always the caller's own. */
export interface AppNotification {
  id: string;
  /** Event key, e.g. 'policy.reack'. */
  type: string;
  title: string;
  body: string | null;
  /** In-app path to open on click. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

/** HR's incomplete-records strip: a live record + the intake details it lacks. */
export interface IncompleteRecord {
  employee: Employee;
  missing: Array<'dateOfJoining' | 'departmentId' | 'designation'>;
}

/** One person as parsed from HR's import CSV — the server validates every cell. */
export interface ImportEmployeeRow {
  email: string;
  name: string;
  managerEmail: string;
  level: string;
  dateOfJoining?: string;
  department?: string;
  designation?: string;
}

export interface ImportEmployeesResult {
  dryRun: boolean;
  /** Only a fully valid file is imported (all or nothing). */
  valid: boolean;
  rows: Array<{ line: number; email: string; name: string; errors: string[] }>;
  /** Real run only — the one-time claim tokens. */
  created: Array<{
    name: string;
    email: string;
    employeeCode: string;
    claimToken: string;
    claimExpiresAt: string;
  }>;
}

// ── Quarter reports (CGP) ────────────────────────────────────────────────────

export type QuarterBand = 'E3' | 'E2' | 'E1' | 'below';

export interface QuarterCycle {
  name: string;
  startDate: string;
  endDate: string;
  closedAt: string | null;
  closedByName: string | null;
  reportCount: number;
  current: boolean;
}

export interface QuarterReport {
  id: string;
  cycleName: string;
  employee: { id: string; name: string; employeeCode: string };
  rm: { id: string; name: string } | null;
  departmentName: string | null;
  goals: Array<{
    title: string;
    category: GoalCategory;
    weight: number;
    progress: number;
    target: string | null;
    dueOn: string;
  }>;
  byCategory: Record<GoalCategory, number | null>;
  computedScore: number | null;
  computedBand: QuarterBand | null;
  finalScore: number | null;
  finalBand: QuarterBand | null;
  adjustReason: string | null;
  adjustedByName: string | null;
  adjustedAt: string | null;
  updates: { expected: number; submitted: number; monthsOverAllowance: number };
  attendance: {
    workingDays: number;
    present: number;
    wfh: number;
    absent: number;
    leave: number;
    lateIns: number;
    attendancePct: number | null;
  };
  recognitions: number;
  feedback: { appreciation: number; concern: number };
  atRiskGoals: number;
  pipCandidate: boolean;
  appraisalEligible: boolean;
}

export interface QuarterTeamOverview {
  rm: { id: string; name: string } | null;
  people: number;
  averageScore: number | null;
  bands: Record<QuarterBand | 'unscored', number>;
}

export interface QuarterView {
  cycle: QuarterCycle;
  reports: QuarterReport[];
  teams: QuarterTeamOverview[];
}

/** A person's notes for their manager or HR — the body only for the sender. */
export interface FeedbackNoteHistory {
  id: string;
  type: 'appreciation' | 'concern';
  author: { id: string; name: string };
  body: string | null;
  createdAt: string;
}

// ── Background jobs (Admin) ─────────────────────────────────────────────────

export interface BackgroundJobRun {
  id: string;
  job: string;
  /** A date for a scheduled run, manual-… for "run now". */
  runKey: string;
  status: 'running' | 'succeeded' | 'failed';
  attempts: number;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
  error: string | null;
}

export interface BackgroundJobsOverview {
  schedulerEnabled: boolean;
  jobs: Array<{ name: string; description: string; schedule: string }>;
  runs: BackgroundJobRun[];
}

// ---- Concerns (disputes, complaints, whistleblower) ----

export type ConcernTrack = 'dispute' | 'complaint' | 'whistleblower';
export type ConcernStatus =
  | 'open'
  | 'acknowledged'
  | 'investigating'
  | 'decided'
  | 'resolved'
  | 'closed'
  | 'declined';
export type ConcernOutcome =
  | 'substantiated'
  | 'partially'
  | 'not_substantiated'
  | 'withdrawn'
  | 'malicious';
export type ConcernQueueName = 'manager' | 'hr' | 'mrc' | 'vigil';

export interface ConcernNote {
  id: string;
  kind: 'note' | 'reply' | 'decision' | 'system';
  level: number | null;
  body: string;
  /** Null for the anonymous raiser. */
  authorName: string | null;
  fromRaiser: boolean;
  visibleToRaiser: boolean;
  createdAt: string;
}

export interface Concern {
  id: string;
  code: string;
  track: ConcernTrack;
  category: string;
  title: string;
  detail: string;
  status: ConcernStatus;
  level: number | null;
  anonymous: boolean;
  raisedBy: { id: string; name: string } | null;
  subject: { id: string; name: string } | null;
  relatedCode: string | null;
  dueAckOn: string | null;
  dueResolveOn: string | null;
  extendedTo: string | null;
  escalateBy: string | null;
  ackAt: string | null;
  outcome: ConcernOutcome | null;
  resolution: string | null;
  closedAt: string | null;
  createdAt: string;
  /** What the caller may do next. */
  can: {
    acknowledge: boolean;
    decide: boolean;
    resolve: boolean;
    extend: boolean;
    decline: boolean;
    accept: boolean;
    escalate: boolean;
    note: boolean;
  };
  notes: ConcernNote[];
}

export interface CreateConcernInput {
  track: ConcernTrack;
  category: string;
  title: string;
  detail: string;
  subjectEmployeeId?: string;
  relatedCode?: string;
  anonymous?: boolean;
  aboutMyManager?: boolean;
}

export interface CreatedConcern {
  concern: Concern;
  /** Anonymous reports only — shown once, never retrievable again. */
  followUpKey: string | null;
}

export interface ConcernQueueSummary {
  queue: ConcernQueueName;
  label: string;
  open: number;
  overdue: number;
}

// ---- Open door ----

export interface OpenDoorSlot {
  id: string;
  owner: { id: string; name: string };
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  note: string | null;
  cancelled: boolean;
  /** The caller's own live booking on this slot, if any. */
  myBookingId: string | null;
}

export type OpenDoorBookingStatus = 'booked' | 'done' | 'cancelled' | 'no_show';

export interface OpenDoorOwnerSlot extends OpenDoorSlot {
  bookings: {
    id: string;
    employee: { id: string; name: string };
    topic: string | null;
    status: OpenDoorBookingStatus;
  }[];
}

export interface OpenDoorMe {
  canPublish: boolean;
  horizonDays: number;
  bookings: {
    id: string;
    status: OpenDoorBookingStatus;
    topic: string | null;
    slot: OpenDoorSlot;
  }[];
  slots: OpenDoorOwnerSlot[];
}

/** Who a session request may go to (HR and department heads). */
export interface OpenDoorHost {
  id: string;
  name: string;
  designation: string | null;
}

export type OpenDoorRequestStatus = 'requested' | 'offered' | 'declined' | 'cancelled';

/** "Request a session" — to a host, or to whoever handles a named concern. */
export interface OpenDoorRequest {
  id: string;
  employee: { id: string; name: string };
  /** Null for a concern request — the case's handlers answer. */
  host: { id: string; name: string } | null;
  concern: { id: string; code: string } | null;
  preferredFrom: string;
  preferredTo: string;
  topic: string | null;
  status: OpenDoorRequestStatus;
  /** The offered time, once offered. */
  slot: OpenDoorSlot | null;
  declineReason: string | null;
  decidedBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface OpenDoorRequests {
  mine: OpenDoorRequest[];
  incoming: OpenDoorRequest[];
}

export interface CreateOpenDoorRequestInput {
  hostId?: string;
  concernId?: string;
  preferredFrom: string;
  preferredTo: string;
  topic?: string;
}

// ── OPS asset manager ───────────────────────────────────────────────────────

export type AssetStatus =
  | 'assigned'
  | 'idle'
  | 'in_use_shared'
  | 'needs_repair'
  | 'scrapped'
  | 'gifted'
  | 'lost';
export type AssetCondition = 'new' | 'good' | 'fair' | 'damaged';
export type AssetRequestType = 'new' | 'upgrade' | 'replacement' | 'repair' | 'return';
export type AssetRequestStatus = 'open' | 'in_progress' | 'fulfilled' | 'declined';
export type GatePassStatus = 'requested' | 'approved' | 'declined' | 'returned';
export type AssetIncidentKind = 'damage' | 'loss' | 'theft';
export type StockMovementKind = 'in' | 'issue' | 'transfer_out' | 'transfer_in' | 'adjust';

export interface NamedRef {
  id: string;
  name: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  codePrefix: string;
  /** `lab` = lent with a due date. */
  kind: 'equipment' | 'lab';
  /** Only these may leave a zone on a gate pass. */
  requiresGatePass: boolean;
}

/** GET /assets — a register entry: always a zone, plus a holder when assigned. */
export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  zone: NamedRef;
  holder: NamedRef | null;
  loanDueOn: string | null;
  loanOverdue: boolean;
  make: string | null;
  model: string | null;
  serialNo: string | null;
  purchasedOn: string | null;
  purchaseCost: number | null;
  vendor: string | null;
  warrantyUntil: string | null;
  condition: AssetCondition;
  notes: string | null;
  giftedTo: NamedRef | null;
  disposedOn: string | null;
  disposeReason: string | null;
  /** The live gate pass — "off premises" is this, not a status. */
  openPass: {
    id: string;
    status: 'requested' | 'approved';
    holder: NamedRef;
    returnOn: string;
    overdue: boolean;
  } | null;
  createdAt: string;
}

export interface AssetEvent {
  id: string;
  kind: string;
  employee: NamedRef | null;
  zone: NamedRef | null;
  status: AssetStatus | null;
  condition: AssetCondition | null;
  dueOn: string | null;
  prevDueOn: string | null;
  note: string | null;
  by: NamedRef | null;
  at: string;
}

export interface AssetIncident {
  id: string;
  asset: { id: string; assetCode: string; name: string };
  employee: NamedRef | null;
  kind: AssetIncidentKind;
  description: string;
  reportedBy: NamedRef;
  status: 'open' | 'closed';
  outcome: string | null;
  closedBy: NamedRef | null;
  closedAt: string | null;
  createdAt: string;
}

export interface AssetDetail extends Asset {
  events: AssetEvent[];
  incidents: AssetIncident[];
  passes: {
    id: string;
    holder: NamedRef;
    purpose: string;
    destination: string;
    status: GatePassStatus;
    returnOn: string;
    createdAt: string;
  }[];
}

export interface AssetOptions {
  categories: AssetCategory[];
  zones: NamedRef[];
  people: (NamedRef & { designation: string | null; baseZoneId: string | null })[];
}

export interface AssetInput {
  assetCode?: string;
  name: string;
  categoryId: string;
  zoneId: string;
  status?: 'idle' | 'in_use_shared' | 'needs_repair';
  holderId?: string;
  loanDueOn?: string;
  make?: string | null;
  model?: string | null;
  serialNo?: string | null;
  purchasedOn?: string | null;
  purchaseCost?: number | null;
  vendor?: string | null;
  warrantyUntil?: string | null;
  condition?: AssetCondition;
  notes?: string | null;
}

/** One CSV row as typed — names, not ids; the server resolves and checks them. */
export interface ImportAssetRow {
  assetCode?: string;
  name?: string;
  category?: string;
  zone?: string;
  status?: string;
  holderEmail?: string;
  loanDueOn?: string;
  make?: string;
  model?: string;
  serialNo?: string;
  purchasedOn?: string;
  purchaseCost?: string;
  vendor?: string;
  warrantyUntil?: string;
  condition?: string;
  notes?: string;
}

export interface ImportAssetsResult {
  ok: boolean;
  created: number;
  errors: { row: number; message: string }[];
}

export interface KitCheck {
  designation: string | null;
  items: { categoryId: string; categoryName: string; qty: number; held: number }[];
}

export interface AssetSetup {
  categories: (AssetCategory & { assetCount: number })[];
  kits: {
    designation: string;
    items: { categoryId: string; categoryName: string; qty: number }[];
  }[];
  designations: string[];
}

export interface AssetRequest {
  id: string;
  requestedBy: NamedRef;
  type: AssetRequestType;
  asset: { id: string; assetCode: string; name: string } | null;
  category: NamedRef | null;
  note: string | null;
  status: AssetRequestStatus;
  handledBy: NamedRef | null;
  handlerNote: string | null;
  fulfilledAsset: { id: string; assetCode: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GatePass {
  id: string;
  asset: { id: string; assetCode: string; name: string; zone: NamedRef };
  /** The requester — answerable for the item until it is back. */
  holder: NamedRef;
  purpose: string;
  destination: string;
  returnOn: string;
  originalReturnOn: string;
  disclaimerAcceptedAt: string;
  status: GatePassStatus;
  overdue: boolean;
  decidedBy: NamedRef | null;
  decidedAt: string | null;
  declineReason: string | null;
  returnedAt: string | null;
  returnedConfirmedBy: NamedRef | null;
  createdAt: string;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  active: boolean;
  total: number;
}

export interface StockOverview {
  items: StockItem[];
  zones: NamedRef[];
  levels: { itemId: string; zoneId: string; qty: number }[];
}

export interface StockMovement {
  id: string;
  item: { id: string; sku: string; name: string; unit: string };
  zone: NamedRef;
  kind: StockMovementKind;
  qty: number;
  employee: NamedRef | null;
  note: string | null;
  by: NamedRef;
  createdAt: string;
}

export interface StockMoveInput {
  kind: 'in' | 'issue' | 'transfer' | 'adjust';
  itemId: string;
  zoneId: string;
  qty: number;
  toZoneId?: string;
  employeeId?: string;
  note?: string;
}

/** GET /my-assets — the caller's own view. */
export interface MyAssetsOverview {
  held: Asset[];
  passes: GatePass[];
  requests: AssetRequest[];
  stock: StockMovement[];
  categories: AssetCategory[];
  passable: {
    id: string;
    assetCode: string;
    name: string;
    category: string;
    zone: string;
    mine: boolean;
  }[];
  disclaimer: string;
}

// ── Exits (resignation, termination, clearances, F&F) ──────────────────────

export type ExitKind = 'resignation' | 'termination';
export type ExitStatus =
  | 'submitted'
  | 'accepted'
  | 'relieved'
  | 'settled'
  | 'withdrawn'
  | 'cancelled';
export type ClearanceKind = 'hr' | 'manager' | 'ops' | 'payroll';

export interface ExitInterview {
  reason: string;
  liked: string;
  improve: string;
  managerRating: number;
  roleRating: number;
  recommend: boolean;
  wouldReturn: boolean;
  newWorkplace?: string;
  other?: string;
}

export interface FnfPreview {
  encashedElDays: number;
  leaveEncashment: number;
  gratuityYears: number;
  gratuity: number;
  noticePay: number;
  noticeRecovery: number;
  sickLopDays: number;
  sickLopDeduction: number;
  fnfRecovery: number;
  /** Outstanding loan / advance balance, recovered automatically. */
  loanBalance: number;
  recoveries: { id: string; label: string; amount: number; note: string | null }[];
  hasSalary: boolean;
}

export interface Exit {
  id: string;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    designation: string | null;
    department: string | null;
    dateOfJoining: string | null;
  };
  rm: NamedRef | null;
  kind: ExitKind;
  status: ExitStatus;
  reason: string;
  initiatedBy: NamedRef;
  noticeStartOn: string;
  noticeDays: number;
  proposedLastDay: string;
  lastWorkingDay: string;
  servedDays: number;
  shortfallDays: number;
  shortfallAction: 'waive' | 'recover' | null;
  shortfallReason: string | null;
  terminationMode: 'serve' | 'pay_in_lieu' | null;
  handoverPlan: string | null;
  acknowledgedBy: NamedRef | null;
  acknowledgedAt: string | null;
  acceptedBy: NamedRef | null;
  acceptedAt: string | null;
  closedBy: NamedRef | null;
  closedAt: string | null;
  closeReason: string | null;
  relievedAt: string | null;
  settledAt: string | null;
  clearances: {
    kind: ClearanceKind;
    clearedBy: NamedRef | null;
    clearedAt: string | null;
    note: string | null;
    opensOn: string | null;
  }[];
  interview: ExitInterview | null;
  interviewAt: string | null;
  holdings: {
    assets: { id: string; assetCode: string; name: string; loanDueOn: string | null }[];
    passes: { id: string; assetCode: string; name: string; returnOn: string }[];
  } | null;
  fnf: FnfPreview | null;
  can: {
    withdraw: boolean;
    acknowledge: boolean;
    accept: boolean;
    cancel: boolean;
    clear: ClearanceKind[];
    interview: boolean;
    recoveries: boolean;
    documents: boolean;
  };
  createdAt: string;
}

/** GET /exits/mine — the resignation page. */
export interface MyExitPage {
  exit: Exit | null;
  noticeDays: number;
  defaultLastDay: string;
  interviewReasons: string[];
}

// ── Close-out: probation, loans, PIP ─────────────────────────────────────────

type Ref = { id: string; name: string };

export interface ProbationReview {
  id: string;
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    designation: string | null;
    department: string | null;
    dateOfJoining: string | null;
  };
  rm: Ref | null;
  dueOn: string;
  /** Confirms by itself when nobody decides (due + 7 days). */
  autoConfirmOn: string;
  status: 'pending' | 'recommended' | 'confirmed' | 'ended';
  recommendation: 'confirm' | 'end' | null;
  recommendationNote: string | null;
  recommendedBy: Ref | null;
  recommendedAt: string | null;
  decidedBy: Ref | null;
  decidedAt: string | null;
  decisionNote: string | null;
  autoConfirmed: boolean;
  exitId: string | null;
  can: { recommend: boolean; decide: boolean; letter: boolean };
  createdAt: string;
}

export interface Loan {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  kind: 'loan' | 'advance';
  principal: number;
  interestRatePct: number;
  months: number;
  startMonth: string;
  emi: number;
  status: 'active' | 'closed' | 'recovered_at_exit';
  note: string | null;
  repaidPrincipal: number;
  repaidInterest: number;
  balance: number;
  instalments: number;
  createdAt: string;
}

export interface LoanDetail extends Loan {
  repayments: Array<{
    month: string | null;
    kind: 'emi' | 'fnf' | 'outside';
    amount: number;
    principal: number;
    interest: number;
    at: string;
  }>;
  schedule: Array<{
    month: string;
    amount: number;
    interest: number;
    principal: number;
    balance: number;
  }>;
}

export interface CreateLoanInput {
  employeeId: string;
  kind: Loan['kind'];
  principal: number;
  interestRatePct: number;
  months: number;
  startMonth: string;
  note?: string;
}

export type PipRating = 'on_track' | 'at_risk' | 'off_track';

export interface Pip {
  id: string;
  employee: { id: string; name: string; employeeCode: string; designation: string | null };
  rm: Ref;
  status: 'pending_hr' | 'active' | 'passed' | 'not_passed' | 'cancelled';
  reason: string;
  targets: Array<{ title: string; measure: string }>;
  support: string;
  startOn: string;
  endOn: string;
  extended: boolean;
  hrBy: Ref | null;
  hrAt: string | null;
  hrNote: string | null;
  acknowledgedAt: string | null;
  outcomeNote: string | null;
  outcomeBy: Ref | null;
  outcomeAt: string | null;
  checkins: Array<{ id: string; on: string; rating: PipRating; note: string; by: Ref }>;
  /** When the next fortnightly check-in is due (active only). */
  nextCheckinOn: string | null;
  can: { decide: boolean; acknowledge: boolean; checkin: boolean; outcome: boolean; cancel: boolean };
  createdAt: string;
}

export interface CreatePipInput {
  employeeId: string;
  reason: string;
  targets: Pip['targets'];
  support: string;
  startOn?: string;
}

/** Seats HR assigns (TA groundwork): one holder each; ended, never deleted. */
export type SeatKind = 'dept_head' | 'vp_hr_head';

export interface Seat {
  id: string;
  seat: SeatKind;
  departmentId: string | null;
  departmentName: string | null;
  employeeId: string;
  employeeName: string;
  acting: boolean;
  startedAt: string;
}

export interface VacantSeat {
  seat: SeatKind;
  departmentId: string | null;
  departmentName: string | null;
}

export interface SeatsOverview {
  seats: Seat[];
  vacant: VacantSeat[];
  /** The Admin account — never offered as a holder. */
  ownerEmployeeId: string | null;
}

// ── Hiring (TA Step B) ───────────────────────────────────────────────────
export type InterviewRound = 'hr' | 'technical' | 'practical' | 'managerial' | 'hr_final';
/** Any HRBP-batch holder approves a hiring request (2026-10-27). */
export type ApproverRole = 'hrbp';
export type HiringPriority = 'high' | 'normal' | 'low';
export type RequisitionStatus =
  | 'draft'
  | 'queued'
  | 'submitted'
  | 'returned'
  | 'approved'
  | 'cancelled'
  | 'rejected';

export interface HiringMe {
  headOf: Array<{ departmentId: string; departmentName: string; acting: boolean }>;
  approverRoles: ApproverRole[];
  /** The quarter heads plan for now, and the day its submitted lines go for approval. */
  planQuarter: string;
  planDeadline: string;
}

export interface Requisition {
  id: string;
  departmentId: string;
  departmentName: string;
  quarter: string | null;
  roleTitle: string;
  quantity: number;
  notes: string | null;
  /** Readable Hiring Request ID, e.g. HR-2027Q1-0007. */
  requestCode: string | null;
  /** Request details (TA workflow deck); null only on lines made before 2026-10-27. */
  reason: string | null;
  targetJoiningOn: string | null;
  location: string | null;
  reportingManager: { id: string; name: string } | null;
  priority: HiringPriority;
  employmentType: string | null;
  version: number;
  status: RequisitionStatus;
  urgent: boolean;
  rounds: Array<{ round: InterviewRound; interviewerId: string | null; interviewerName: string | null }>;
  /** Decisions on the current version only. */
  approvals: Array<{
    role: ApproverRole;
    decision: 'approve' | 'reject';
    decidedByName: string;
    reason: string | null;
    decidedAt: string;
  }>;
  waitingOn: ApproverRole[];
  returnReason: string | null;
  createdByName: string;
  submittedAt: string | null;
  approvedAt: string | null;
  /** The TA RM Admin gave the line to — they assign its positions to their team. */
  taRm: { id: string; name: string } | null;
  taRmAssignedAt: string | null;
  createdAt: string;
  /** Step C — present once the line is approved. */
  positions: Position[];
}

/** Someone Admin can give a line to: holds the TA batch and has reports. */
/** A report the TA RM can give a position to (holds the TA batch). */
export interface RecruiterOption {
  id: string;
  name: string;
  employeeCode: string;
}

export interface TaRmOption {
  id: string;
  name: string;
  employeeCode: string;
  reports: number;
}

export interface HiringPlan {
  departmentId: string;
  quarter: string;
  /** Submitted lines wait until this day, then go to the approvers together. */
  deadline: string;
  /** The quarter being planned now — the only one that takes new lines. */
  open: boolean;
  requisitions: Requisition[];
}

export interface RequisitionInput {
  roleTitle: string;
  quantity: number;
  notes?: string | null;
  reason: string;
  targetJoiningOn: string;
  location: string;
  reportingManagerId: string;
  priority: HiringPriority;
  employmentType: string;
  rounds: Array<{ round: InterviewRound; interviewerId: string | null }>;
}

// ── Hiring Step C: positions, JD + scorecard ─────────────────────────────
export type PositionStatus =
  | 'awaiting_docs'
  | 'open'
  | 'interviewing'
  | 'offer'
  | 'filled'
  | 'cancelled';
/** A position's JD / scorecard reviewers: the line's TA RM + the dept head. */
export type DocRole = 'dept_head' | 'ta_rm';

/** A sourcing channel activated for a position (workflow deck step 6). */
export interface SourceActivation {
  id: string;
  channel: CandidateSource;
  activatedOn: string;
  spocName: string;
  notes: string | null;
}

export interface Position {
  id: string;
  number: number;
  status: PositionStatus;
  /** TA ownership: priority (from the line) and the expected closure date. */
  priority: HiringPriority;
  expectedCloseOn: string | null;
  sources: SourceActivation[];
  recruiterId: string | null;
  recruiterName: string | null;
  /** The recruiter's hiring goal this quarter (progress follows the position). */
  goal: { id: string; weight: number; progress: number } | null;
  openedAt: string | null;
  /** Its own JD + scorecard, written by its recruiter. */
  documents: { jd: TaDocument | null; scorecard: TaDocument | null };
}

/** The JD's role-specific parts (company template); the fixed company text is added on display. */
export interface JdContent {
  jobType: string;
  city: string;
  ctc: string;
  businessUnit: string;
  roleSummary: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
}

/** One round's sheet: its weight (%) and the attributes it rates, with the questions to ask. */
export interface ScorecardRound {
  round: InterviewRound;
  weight: number;
  attributes: Array<{ name: string; questions: string[] }>;
}

/** The scorecard, as per the company's Excel: round weights add up to 100. */
export interface ScorecardContent {
  rounds: ScorecardRound[];
}

export interface TaDocument {
  id: string;
  kind: 'jd' | 'scorecard';
  version: number;
  status: 'draft' | 'in_review' | 'returned' | 'approved';
  content: Record<string, unknown>;
  writtenByName: string;
  returnReason: string | null;
  approvals: Array<{
    role: DocRole;
    decision: 'approve' | 'reject';
    decidedByName: string;
    reason: string | null;
    decidedAt: string;
  }>;
  waitingOn: DocRole[];
  submittedAt: string | null;
  approvedAt: string | null;
}

export interface DocumentReview {
  requisitionId: string;
  departmentName: string;
  roleTitle: string;
  quantity: number;
  positionId: string;
  positionNumber: number;
  recruiterName: string | null;
  document: TaDocument;
}

// ── Hiring Step D: candidates, applications, interviews ──────────────────
export type CandidateSource =
  | 'naukri'
  | 'linkedin'
  | 'internshala'
  | 'careers_page'
  | 'agency'
  | 'campus'
  | 'social'
  | 'referral'
  | 'internal'
  | 'other';
export type ApplicationStage =
  | 'sourced'
  | 'shortlisted'
  | 'interviewing'
  | 'interviewed'
  | 'decision'
  | 'selected'
  | 'offered'
  | 'hired'
  | 'offer_declined'
  | 'offer_withdrawn'
  | 'no_show'
  | 'rejected'
  | 'withdrawn'
  | 'joined';

export type InterviewMode = 'in_person' | 'video' | 'phone';

/** When and how a round happens (scheduled by the recruiter / TA RM). */
export interface InterviewSlot {
  id: string;
  startsAt: string;
  durationMin: number;
  mode: InterviewMode;
  /** Room / address, meeting link, or phone number. */
  location: string | null;
  status: 'scheduled' | 'done' | 'cancelled' | 'no_show';
  endReason: string | null;
}

export interface RoundScore {
  round: InterviewRound;
  interviewerName: string;
  /** Per attribute: 1–4 and the evidence written for it. */
  scores: Array<{ attribute: string; score: number; evidence: string | null }>;
  /** The round out of 100. */
  roundScore: number;
  recommendation: 'hire' | 'no_hire';
  notes: string | null;
  submittedAt: string;
}

export interface Application {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateCode: string | null;
  candidateSource: CandidateSource;
  candidateNoticeDays: number | null;
  /** Live progress: what happens next, who does it, by when. */
  nextAction: { text: string; ownerId: string | null; ownerName: string | null; due: string | null } | null;
  contactCount: number;
  lastContactAt: string | null;
  positionId: string;
  positionNumber: number;
  requisitionId: string;
  /** The line's TA RM — validates the shortlist and decides the hire. */
  taRmId: string | null;
  /** The position's recruiter — works the candidate and schedules the rounds. */
  recruiterId: string | null;
  roleTitle: string;
  departmentName: string;
  stage: ApplicationStage;
  /** The round open now — rounds run one after another; null outside interviews. */
  currentRound: InterviewRound | null;
  /** The rejection record: the round, who rejected, when the candidate was told. */
  rejectedRound: InterviewRound | null;
  rejectedByName: string | null;
  informedAt: string | null;
  shortlistedByName: string | null;
  outcomeReason: string | null;
  rounds: Array<{
    round: InterviewRound;
    /** The round's weight on the position's scorecard (%). */
    weight: number | null;
    interviewerId: string | null;
    interviewerName: string | null;
    score: RoundScore | null;
    slot: InterviewSlot | null;
  }>;
  /** Σ round score × weight over the rounds scored so far, out of 100. */
  scoreTotal: number | null;
  candidateEducation: string | null;
  candidateExperienceYears: number | null;
  createdAt: string;
  /** Last change — the board's "days since it last moved". */
  updatedAt: string;
  /** The offer waits for the line's approval (always true once positions exist). */
  lineApproved: boolean;
  /** TA drafts the terms + letter → the HR Head approves and signs → TA shares. */
  offer: {
    status: 'draft' | 'pending' | 'approved' | 'returned';
    ctc: number | null;
    joiningDate: string | null;
    terms: string | null;
    returnReason: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
  } | null;
  offeredCtc: number | null;
  joiningDate: string | null;
  hasOfferLetter: boolean;
  hasSignedLetter: boolean;
  documents: { received: number; pending: number; total: number };
  folderLink: string | null;
  employeeId: string | null;
  /** HRBP confirmed the actual joining. */
  joinedAt: string | null;
}

export type CandidateDocStatus = 'requested' | 'received' | 'not_applicable';

/** A document asked of the candidate after the last round. */
export interface CandidateDocument {
  id: string;
  name: string;
  status: CandidateDocStatus;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource;
  referredByName: string | null;
  notes: string | null;
  /** Readable candidate ID, e.g. C-000123. */
  candidateCode: string | null;
  education: string | null;
  experienceYears: number | null;
  currentCompany: string | null;
  designation: string | null;
  location: string | null;
  noticeDays: number | null;
  currentCtc: number | null;
  expectedCtc: number | null;
  availableFrom: string | null;
  hasCv: boolean;
  retainUntil: string;
  anonymised: boolean;
  createdAt: string;
  applications: Application[];
}

/** The Hiring board: live lines and every candidate on their positions. */
export interface HiringBoard {
  lines: Requisition[];
  applications: Application[];
}

export interface CandidateMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CandidateInput {
  name: string;
  email?: string;
  phone?: string;
  source: CandidateSource;
  referredById?: string;
  notes?: string;
  education: string;
  experienceYears: number;
  currentCompany?: string;
  designation?: string;
  location: string;
  noticeDays: number;
  currentCtc?: number;
  expectedCtc?: number;
  availableFrom?: string;
  consent: true;
}

/** Fill or correct a candidate's profile (TA). */
export type CandidateUpdate = Partial<{
  name: string;
  education: string;
  experienceYears: number;
  currentCompany: string | null;
  designation: string | null;
  location: string;
  noticeDays: number;
  currentCtc: number | null;
  expectedCtc: number | null;
  availableFrom: string | null;
}>;

export type ActivityKind = 'call' | 'email' | 'whatsapp' | 'meeting';
export type ActivityOutcome = 'connected' | 'no_answer' | 'busy' | 'wrong_number' | 'other';

/** A contact with the candidate on an application. */
export interface Activity {
  id: string;
  kind: ActivityKind;
  outcome: ActivityOutcome;
  notes: string | null;
  happenedAt: string;
  byName: string;
}

export interface MyInterview {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  hasCv: boolean;
  roleTitle: string;
  departmentName: string;
  round: InterviewRound;
  /** This round's weight on the scorecard (%). */
  roundWeight: number | null;
  /** This round's sheet only. */
  attributes: Array<{ name: string; questions: string[] }>;
  candidateEducation: string | null;
  candidateExperienceYears: number | null;
  jdSummary: string | null;
  /** When and how — null until the recruiter schedules it. */
  slot: InterviewSlot | null;
  myScore: RoundScore | null;
}

// ── Hiring Step E: decision, offer, BGV, hire ────────────────────────────
export type HireRole = 'dept_head' | 'ta_rm' | 'hr_head' | 'admin';
export type BgvStatus = 'not_started' | 'in_progress' | 'clear' | 'failed';

export interface MarkHiredInput {
  email: string;
  employeeCode: string;
  level: Level;
  reportsToId: string;
  designation?: string;
  employmentType?: 'intern' | 'permanent' | 'contract';
}

export interface MarkHiredResult {
  application: Application;
  employeeId: string;
  claim: { token: string; expiresAt: string };
}

// ── Hiring reports + trackers (workflow deck slides 13–16) ──
export interface HiringReportRow {
  positionId: string;
  requestCode: string | null;
  roleTitle: string;
  positionNumber: number;
  departmentName: string;
  spocName: string | null;
  sourced: number;
  callAttempts: number;
  callUnique: number;
  screened: number;
  aligned: number;
  held: number;
  offersShared: number;
  accepted: number;
  joined: number;
  rejected: number;
  withdrawn: number;
  overdue: number;
}

export interface HiringReport {
  from: string;
  to: string;
  rows: HiringReportRow[];
}

export interface PendingAction {
  applicationId: string;
  candidateName: string;
  candidateCode: string | null;
  roleTitle: string;
  positionNumber: number;
  stage: ApplicationStage;
  nextAction: string;
  ownerName: string | null;
  due: string | null;
  overdue: boolean;
}

export type TrackerView = 'internal' | 'external';

/** One candidate on one position; the external view leaves contacts and CTC out (null). */
export interface TrackerRow {
  applicationId: string;
  requestCode: string | null;
  candidateCode: string | null;
  candidateName: string;
  roleTitle: string;
  positionNumber: number;
  departmentName: string;
  spocName: string | null;
  source: CandidateSource;
  stage: ApplicationStage;
  currentRound: InterviewRound | null;
  experienceYears: number | null;
  location: string | null;
  noticeDays: number | null;
  joiningDate: string | null;
  scoreTotal: number | null;
  addedOn: string;
  email: string | null;
  phone: string | null;
  currentCtc: number | null;
  expectedCtc: number | null;
  offeredCtc: number | null;
}

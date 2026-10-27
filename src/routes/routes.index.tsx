import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { APP_SECTION } from '@constants/Common/auth/portal.constants';
import { ROUTE_TITLES } from '@constants/Common/navigation/documentTitles.constants';
import { GRIEVANCES_ROUTE } from '@constants/Common/navigation/routes.constants';
import AdminLayout from '@layouts/Admin/admin.layout';
import EmployeeLayout from '@layouts/Employee/employee.layout';
import HrLayout from '@layouts/Hr/hr.layout';
import NotFoundPage from '@pages/Common/Handlers/NotFound.page';
import ProtectedRoute from '@providers/ProtectedRoute.guard';
import { lazyRoute } from '@utils/lazyRoute';
import RouteScreen from './RouteScreen.route';

/*
 * One chunk per screen: every page loads through lazyRoute so the sign-in
 * screen never pays for the consoles. The wait is covered by the Suspense
 * inside RouteScreen.
 */
const AuthPage = lazyRoute(() => import('@pages/Common/Authentication/Auth.page'));

const HomePage = lazyRoute(() => import('@pages/Employee/Home/Home.page'));
const ProfilePage = lazyRoute(() => import('@pages/Employee/Profile/Profile.page'));
const MyTeamPage = lazyRoute(() => import('@pages/Employee/MyTeam/MyTeam.page'));
const MyAssetsPage = lazyRoute(() => import('@pages/Employee/Assets/MyAssets.page'));
const MyLeavesPage = lazyRoute(() => import('@pages/Employee/Leaves/MyLeaves.page'));
const TeamLeavesPage = lazyRoute(() => import('@pages/Employee/Leaves/TeamLeaves.page'));
const MyAttendancePage = lazyRoute(() => import('@pages/Employee/Attendance/MyAttendance.page'));
const TeamAttendancePage = lazyRoute(
  () => import('@pages/Employee/Attendance/TeamAttendance.page'),
);
const MyPayslipsPage = lazyRoute(() => import('@pages/Employee/Payslips/MyPayslips.page'));
const ReimbursementsPage = lazyRoute(
  () => import('@pages/Employee/Reimbursements/Reimbursements.page'),
);
const MyPoliciesPage = lazyRoute(() => import('@pages/Employee/Policies/MyPolicies.page'));
const MyOnboardingPage = lazyRoute(() => import('@pages/Employee/Onboarding/MyOnboarding.page'));
const RecognitionPage = lazyRoute(() => import('@pages/Employee/Recognition/Recognition.page'));
const MyGrowthPage = lazyRoute(() => import('@pages/Employee/Growth/MyGrowth.page'));
const MyPerformancePage = lazyRoute(() => import('@pages/Employee/Performance/MyPerformance.page'));
const ResignationPage = lazyRoute(() => import('@pages/Employee/Exit/Resignation.page'));
const GrievancesPage = lazyRoute(() => import('@pages/Employee/Grievances/Grievances.page'));
const HiringPlanPage = lazyRoute(() => import('@pages/Employee/Hiring/HiringPlan.page'));
const HiringApprovalsPage = lazyRoute(() => import('@pages/Common/Hiring/HiringApprovals.page'));
const MyInterviewsPage = lazyRoute(() => import('@pages/Employee/Hiring/MyInterviews.page'));
const CandidatesPage = lazyRoute(() => import('@pages/Ta/Candidates/Candidates.page'));
const ConcernFollowUpPage = lazyRoute(
  () => import('@pages/Employee/Concerns/ConcernFollowUp.page'),
);

const PeoplePage = lazyRoute(() => import('@pages/Hrbp/People/People.page'));
const OrgStructurePage = lazyRoute(() => import('@pages/Hrbp/OrgStructure/OrgStructure.page'));
const DepartmentsPage = lazyRoute(() => import('@pages/Hrbp/Departments/Departments.page'));
const SeatsPage = lazyRoute(() => import('@pages/Admin/Seats/Seats.page'));
const ExitsPage = lazyRoute(() => import('@pages/Hrbp/Exits/Exits.page'));
const HrLeavesPage = lazyRoute(() => import('@pages/Hrbp/Leaves/Leaves.page'));
const HrAttendancePage = lazyRoute(() => import('@pages/Hrbp/Attendance/Attendance.page'));
const HrPoliciesPage = lazyRoute(() => import('@pages/Hrbp/Policies/Policies.page'));
const HrOnboardingPage = lazyRoute(() => import('@pages/Hrbp/Onboarding/Onboarding.page'));
const HrSettingsPage = lazyRoute(() => import('@pages/Hrbp/Settings/HrSettings.page'));
const QuarterReportsPage = lazyRoute(
  () => import('@pages/Hrbp/QuarterReports/QuarterReports.page'),
);
const HiringPage = lazyRoute(() => import('@pages/Ta/Hiring/Hiring.page'));
const PayrollPage = lazyRoute(() => import('@pages/Pr/Payroll/Payroll.page'));

const AssetsPage = lazyRoute(() => import('@pages/Ops/Assets/Assets.page'));
const RequestQueuePage = lazyRoute(() => import('@pages/Ops/Requests/RequestQueue.page'));
const GatePassesPage = lazyRoute(() => import('@pages/Ops/GatePasses/GatePasses.page'));
const StockPage = lazyRoute(() => import('@pages/Ops/Stock/Stock.page'));
const OpsSetupPage = lazyRoute(() => import('@pages/Ops/Setup/OpsSetup.page'));

const InviteEmployeePage = lazyRoute(() => import('@pages/Admin/Invite/InviteEmployee.page'));
const AdminHomePage = lazyRoute(() => import('@pages/Admin/Home/AdminHome.page'));
const BatchesPage = lazyRoute(() => import('@pages/Admin/Access/Batches.page'));
const GrantRequestsPage = lazyRoute(() => import('@pages/Admin/Access/GrantRequests.page'));
const AuditLogPage = lazyRoute(() => import('@pages/Admin/Audit/AuditLog.page'));
const PunchZonesPage = lazyRoute(() => import('@pages/Admin/Zones/PunchZones.page'));
const OrgSettingsPage = lazyRoute(() => import('@pages/Admin/Settings/OrgSettings.page'));

/*
 * The whole route tree, in one file — grouped by app section for reading;
 * React Router matches by specificity, not source order.
 *
 * Unlike the XOR demo's three separate portals, the HRMS is ONE app: every
 * signed-in person gets the Employee shell at `/`, and the HR (/hr) and Admin
 * (/admin) consoles are extra shells unlocked by the batches the person holds
 * (design doc §1). HR is one console enclosing its four portal sections —
 * HRBP, TA, PR and OPS. Each shell pairs the guard with that section's chrome.
 */

const EmployeeShell = () => (
  <ProtectedRoute section={APP_SECTION.employee}>
    <EmployeeLayout>
      <Outlet />
    </EmployeeLayout>
  </ProtectedRoute>
);

const HrShell = () => (
  <ProtectedRoute section={APP_SECTION.hr}>
    <HrLayout>
      <Outlet />
    </HrLayout>
  </ProtectedRoute>
);

const AdminShell = () => (
  <ProtectedRoute section={APP_SECTION.admin}>
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  </ProtectedRoute>
);

const AppRoutes = () => (
  <Routes>
    {/* ── Public: sign in / claim (outside every shell, reachable signed out) ── */}
    <Route
      path='/auth'
      element={
        <RouteScreen title={ROUTE_TITLES.auth}>
          <AuthPage />
        </RouteScreen>
      }
    />

    {/* ── Employee (everyone) ─────────────────────────────── */}
    <Route path='/' element={<EmployeeShell />}>
      <Route
        index
        element={
          <RouteScreen title={ROUTE_TITLES.home}>
            <HomePage />
          </RouteScreen>
        }
      />
      <Route
        path='profile'
        element={
          <RouteScreen title={ROUTE_TITLES.profile}>
            <ProfilePage />
          </RouteScreen>
        }
      />
      <Route
        path='my-team'
        element={
          <RouteScreen title={ROUTE_TITLES.myTeam}>
            <MyTeamPage />
          </RouteScreen>
        }
      />
      <Route
        path='my-assets'
        element={
          <RouteScreen title={ROUTE_TITLES.myAssets}>
            <MyAssetsPage />
          </RouteScreen>
        }
      />
      <Route
        path='my-leaves'
        element={
          <RouteScreen title={ROUTE_TITLES.myLeaves}>
            <MyLeavesPage />
          </RouteScreen>
        }
      />
      <Route
        path='team-leaves'
        element={
          <RouteScreen title={ROUTE_TITLES.teamLeaves}>
            <TeamLeavesPage />
          </RouteScreen>
        }
      />
      <Route
        path='my-attendance'
        element={
          <RouteScreen title={ROUTE_TITLES.myAttendance}>
            <MyAttendancePage />
          </RouteScreen>
        }
      />
      <Route
        path='team-attendance'
        element={
          <RouteScreen title={ROUTE_TITLES.teamAttendance}>
            <TeamAttendancePage />
          </RouteScreen>
        }
      />
      <Route
        path='my-payslips'
        element={
          <RouteScreen title={ROUTE_TITLES.myPayslips}>
            <MyPayslipsPage />
          </RouteScreen>
        }
      />
      <Route
        path='reimbursements'
        element={
          <RouteScreen title={ROUTE_TITLES.reimbursements}>
            <ReimbursementsPage />
          </RouteScreen>
        }
      />
      <Route
        path='grievances'
        element={
          <RouteScreen title={ROUTE_TITLES.grievances}>
            <GrievancesPage />
          </RouteScreen>
        }
      />
      {/* Concerns and open door now live on Grievances; old links still work. */}
      <Route
        path='concerns'
        element={<Navigate to={`${GRIEVANCES_ROUTE}?tab=concerns`} replace />}
      />
      <Route
        path='concerns/follow-up'
        element={
          <RouteScreen title={ROUTE_TITLES.concernFollowUp}>
            <ConcernFollowUpPage />
          </RouteScreen>
        }
      />
      <Route
        path='open-door'
        element={<Navigate to={`${GRIEVANCES_ROUTE}?tab=open-door`} replace />}
      />
      <Route
        path='hiring/plan'
        element={
          <RouteScreen title={ROUTE_TITLES.hiringPlan}>
            <HiringPlanPage />
          </RouteScreen>
        }
      />
      <Route
        path='hiring/approvals'
        element={
          <RouteScreen title={ROUTE_TITLES.hiringApprovals}>
            <HiringApprovalsPage />
          </RouteScreen>
        }
      />
      <Route
        path='hiring/interviews'
        element={
          <RouteScreen title={ROUTE_TITLES.myInterviews}>
            <MyInterviewsPage />
          </RouteScreen>
        }
      />
      <Route
        path='policies'
        element={
          <RouteScreen title={ROUTE_TITLES.policies}>
            <MyPoliciesPage />
          </RouteScreen>
        }
      />
      <Route
        path='onboarding'
        element={
          <RouteScreen title={ROUTE_TITLES.onboarding}>
            <MyOnboardingPage />
          </RouteScreen>
        }
      />
      <Route
        path='recognition'
        element={
          <RouteScreen title={ROUTE_TITLES.recognition}>
            <RecognitionPage />
          </RouteScreen>
        }
      />
      <Route
        path='growth'
        element={
          <RouteScreen title={ROUTE_TITLES.growth}>
            <MyGrowthPage />
          </RouteScreen>
        }
      />
      <Route
        path='performance'
        element={
          <RouteScreen title={ROUTE_TITLES.performance}>
            <MyPerformancePage />
          </RouteScreen>
        }
      />
      <Route
        path='resignation'
        element={
          <RouteScreen title={ROUTE_TITLES.resignation}>
            <ResignationPage />
          </RouteScreen>
        }
      />
    </Route>

    {/* ── HR console (HRBP / TA / PR / OPS batches) ───────── */}
    <Route path='/hr' element={<HrShell />}>
      <Route
        index
        element={
          <RouteScreen title={ROUTE_TITLES.hrPeople}>
            <PeoplePage />
          </RouteScreen>
        }
      />
      <Route
        path='people'
        element={
          <RouteScreen title={ROUTE_TITLES.hrPeople}>
            <PeoplePage />
          </RouteScreen>
        }
      />
      <Route
        path='org-structure'
        element={
          <RouteScreen title={ROUTE_TITLES.hrOrg}>
            <OrgStructurePage />
          </RouteScreen>
        }
      />
      <Route
        path='departments'
        element={
          <RouteScreen title={ROUTE_TITLES.hrDepartments}>
            <DepartmentsPage />
          </RouteScreen>
        }
      />
      <Route
        path='exits'
        element={
          <RouteScreen title={ROUTE_TITLES.hrExits}>
            <ExitsPage />
          </RouteScreen>
        }
      />
      <Route
        path='leaves'
        element={
          <RouteScreen title={ROUTE_TITLES.hrLeaves}>
            <HrLeavesPage />
          </RouteScreen>
        }
      />
      <Route
        path='attendance'
        element={
          <RouteScreen title={ROUTE_TITLES.hrAttendance}>
            <HrAttendancePage />
          </RouteScreen>
        }
      />
      <Route
        path='quarter-reports'
        element={
          <RouteScreen title={ROUTE_TITLES.hrQuarterReports}>
            <QuarterReportsPage />
          </RouteScreen>
        }
      />
      <Route
        path='settings'
        element={
          <RouteScreen title={ROUTE_TITLES.hrSettings}>
            <HrSettingsPage />
          </RouteScreen>
        }
      />
      <Route
        path='policies'
        element={
          <RouteScreen title={ROUTE_TITLES.hrPolicies}>
            <HrPoliciesPage />
          </RouteScreen>
        }
      />
      <Route
        path='onboarding'
        element={
          <RouteScreen title={ROUTE_TITLES.hrOnboarding}>
            <HrOnboardingPage />
          </RouteScreen>
        }
      />
      <Route
        path='hiring'
        element={
          <RouteScreen title={ROUTE_TITLES.hrHiring}>
            <HiringPage />
          </RouteScreen>
        }
      />
      <Route
        path='candidates'
        element={
          <RouteScreen title={ROUTE_TITLES.hrCandidates}>
            <CandidatesPage />
          </RouteScreen>
        }
      />
      <Route
        path='payroll'
        element={
          <RouteScreen title={ROUTE_TITLES.hrPayroll}>
            <PayrollPage />
          </RouteScreen>
        }
      />
      {/* OPS section (asset management) */}
      <Route
        path='assets'
        element={
          <RouteScreen title={ROUTE_TITLES.opsAssets}>
            <AssetsPage />
          </RouteScreen>
        }
      />
      <Route
        path='asset-requests'
        element={
          <RouteScreen title={ROUTE_TITLES.opsRequests}>
            <RequestQueuePage />
          </RouteScreen>
        }
      />
      <Route
        path='gate-passes'
        element={
          <RouteScreen title={ROUTE_TITLES.opsGatePasses}>
            <GatePassesPage />
          </RouteScreen>
        }
      />
      <Route
        path='stock'
        element={
          <RouteScreen title={ROUTE_TITLES.opsStock}>
            <StockPage />
          </RouteScreen>
        }
      />
      <Route
        path='ops-setup'
        element={
          <RouteScreen title={ROUTE_TITLES.opsSetup}>
            <OpsSetupPage />
          </RouteScreen>
        }
      />
    </Route>

    {/* ── Admin console (Owner / SuperAdmin) ──────────────── */}
    <Route path='/admin' element={<AdminShell />}>
      <Route
        index
        element={
          <RouteScreen title={ROUTE_TITLES.adminHome}>
            <AdminHomePage />
          </RouteScreen>
        }
      />
      <Route
        path='invite'
        element={
          <RouteScreen title={ROUTE_TITLES.adminInvite}>
            <InviteEmployeePage />
          </RouteScreen>
        }
      />
      <Route
        path='batches'
        element={
          <RouteScreen title={ROUTE_TITLES.adminBatches}>
            <BatchesPage />
          </RouteScreen>
        }
      />
      <Route
        path='seats'
        element={
          <RouteScreen title={ROUTE_TITLES.adminSeats}>
            <SeatsPage />
          </RouteScreen>
        }
      />
      <Route
        path='grant-requests'
        element={
          <RouteScreen title={ROUTE_TITLES.adminGrantRequests}>
            <GrantRequestsPage />
          </RouteScreen>
        }
      />
      <Route
        path='punch-zones'
        element={
          <RouteScreen title={ROUTE_TITLES.adminPunchZones}>
            <PunchZonesPage />
          </RouteScreen>
        }
      />
      <Route
        path='settings'
        element={
          <RouteScreen title={ROUTE_TITLES.adminSettings}>
            <OrgSettingsPage />
          </RouteScreen>
        }
      />
      <Route
        path='hiring-approvals'
        element={
          <RouteScreen title={ROUTE_TITLES.hiringApprovals}>
            <HiringApprovalsPage />
          </RouteScreen>
        }
      />
      <Route
        path='audit-log'
        element={
          <RouteScreen title={ROUTE_TITLES.adminAudit}>
            <AuditLogPage />
          </RouteScreen>
        }
      />
    </Route>

    {/* Outside every shell: an unmatched URL cannot assume a console's chrome. */}
    <Route
      path='*'
      element={
        <RouteScreen title={ROUTE_TITLES.notFound}>
          <NotFoundPage />
        </RouteScreen>
      }
    />
  </Routes>
);

export default AppRoutes;

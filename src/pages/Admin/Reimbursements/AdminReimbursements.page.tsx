import ReimbursementDesk from '@components/Common/Reimbursements/ReimbursementDesk.component';

/**
 * Admin console → Reimbursements: the Admin account's step of the claim trail
 * (after PR, or in PR's place — an Admin approval is final) and the same
 * reimbursement sheet PR pays from.
 */
const AdminReimbursementsPage = () => (
  <div className='w-full max-w-4xl space-y-4'>
    <div>
      <h1 className='text-2xl font-semibold text-slate-800'>Reimbursements</h1>
      <p className='text-sm text-slate-500'>
        Claims PR has approved wait here for you. Approved claims are paid by PR from the
        reimbursement sheet, not on the payslip.
      </p>
    </div>
    <ReimbursementDesk role='admin' />
  </div>
);

export default AdminReimbursementsPage;

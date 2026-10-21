import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { ReimbursementStatus } from '@app-types/api.types';
import ClaimRow from '@components/Common/Reimbursements/ClaimRow.component';
import { inr } from '@constants/Common/reimbursements.constants';
import { reimbursementsApi } from '@services/api/reimbursements.api';
import { apiErrorMessage } from '@utils/apiError';

const VIEWS: Record<string, { label: string; statuses: ReimbursementStatus[] }> = {
  payroll: { label: 'Waiting on payroll', statuses: ['pending_payroll'] },
  approved: { label: 'Approved, not paid yet', statuses: ['approved'] },
  manager: { label: 'With managers', statuses: ['pending_rm'] },
  done: { label: 'Paid / declined / withdrawn', statuses: ['paid', 'declined', 'cancelled'] },
};

/**
 * Payroll's side of the claim trail: approve or decline what managers passed
 * on; approved claims land on the next draft's Reimbursement line by themselves.
 */
const ReimbursementQueue = () => {
  const [view, setView] = useState<keyof typeof VIEWS>('payroll');
  const statuses = VIEWS[view]!.statuses;
  const claims = useQuery({
    queryKey: ['payroll-reimbursements', view],
    queryFn: () => reimbursementsApi.queue(statuses),
  });
  const total = (claims.data ?? []).reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex flex-wrap gap-2'>
        {Object.entries(VIEWS).map(([k, v]) => (
          <button
            key={k}
            type='button'
            onClick={() => setView(k)}
            className={`rounded-full px-3 py-1 text-xs ${
              view === k
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className='text-xs text-slate-400'>
        Approved claims are added to the next payroll draft for the month they were spent in (or
        later) and marked paid when that month is finalized.
        {claims.data && claims.data.length > 0 && ` ${claims.data.length} claims · ${inr(total)}.`}
      </p>
      {claims.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
      {claims.error && <p className='text-sm text-red-600'>{apiErrorMessage(claims.error)}</p>}
      {claims.data?.length === 0 && <p className='text-sm text-slate-400'>Nothing here.</p>}
      <ul className='space-y-2'>
        {(claims.data ?? []).map((c) => (
          <ClaimRow
            key={c.id}
            claim={c}
            mode={view === 'payroll' ? 'approver' : 'view'}
            showPerson
            invalidate={[['payroll-reimbursements'], ['payroll-run'], ['payroll-runs']]}
          />
        ))}
      </ul>
    </div>
  );
};

export default ReimbursementQueue;

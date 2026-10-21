import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DecideLeaveInput, LeaveStatus } from '@app-types/api.types';
import LeaveQueueTable from '@components/Common/Leaves/LeaveQueueTable.component';
import { leavesApi } from '@services/api/leaves.api';
import { apiErrorMessage } from '@utils/apiError';

const FILTERS: Array<{ label: string; value: LeaveStatus | '' }> = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Partially approved', value: 'partially_approved' },
  { label: 'Approved', value: 'approved' },
  { label: 'Declined', value: 'declined' },
  { label: 'Cancelled', value: 'cancelled' },
];

/** The HR half of the dual approval — org-wide queue behind hrbp.leaves. */
const LeavesPage = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LeaveStatus | ''>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-leaves', status],
    queryFn: () => leavesApi.listQueue(status || undefined),
  });

  const decide = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideLeaveInput }) =>
      leavesApi.decide(id, input),
    // onSettled + every surface a leave decision touches (review finding M11).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['team-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
    },
  });

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Leaves</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LeaveStatus | '')}
          className='rounded-md border border-slate-300 px-3 py-2 text-sm'
        >
          {FILTERS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {error && <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>}
        {decide.error && <p className='text-sm text-red-600'>{apiErrorMessage(decide.error)}</p>}
        {data && (
          <LeaveQueueTable
            leaves={data}
            slot='hr'
            deciding={decide.isPending}
            onDecide={(id, decision, reason) => decide.mutate({ id, input: { decision, reason } })}
          />
        )}
      </div>
    </div>
  );
};

export default LeavesPage;

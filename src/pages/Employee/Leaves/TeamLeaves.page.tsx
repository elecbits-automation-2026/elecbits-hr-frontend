import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DecideLeaveInput } from '@app-types/api.types';
import LeaveQueueTable from '@components/Common/Leaves/LeaveQueueTable.component';
import { leavesApi } from '@services/api/leaves.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * The RM's half of the dual approval: requests from people who route to the
 * caller as reporting manager or leave approver. The nav item only shows for
 * RMs, but the backend filters by relationship regardless.
 */
const TeamLeavesPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['team-leaves'],
    queryFn: leavesApi.listTeam,
  });

  const decide = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideLeaveInput }) =>
      leavesApi.decide(id, input),
    // onSettled + every surface a leave decision touches: the HR queue (a
    // dual-role approver sees both), balances, and the attendance calendars
    // where an approved leave becomes an inert day (review finding M11).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['team-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
    },
  });

  return (
    <div className='w-full space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Team leaves</h1>
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {error && <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>}
        {decide.error && <p className='text-sm text-red-600'>{apiErrorMessage(decide.error)}</p>}
        {data && (
          <LeaveQueueTable
            leaves={data}
            slot='rm'
            deciding={decide.isPending}
            onDecide={(id, decision, reason) => decide.mutate({ id, input: { decision, reason } })}
          />
        )}
      </div>
    </div>
  );
};

export default TeamLeavesPage;

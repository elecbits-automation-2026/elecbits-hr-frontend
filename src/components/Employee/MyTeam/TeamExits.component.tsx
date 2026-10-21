import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ExitCard from '@components/Common/Exits/ExitCard.component';
import { EXIT_STATUS_CLASS, EXIT_STATUS_LABELS, longDay } from '@constants/Common/exits.constants';
import { exitsApi } from '@services/api/exits.api';

/**
 * My team, for a manager: people who are leaving. Acknowledge with a
 * handover plan, then clear the handover during their notice.
 */
const TeamExits = () => {
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ['team-exits'], queryFn: exitsApi.team });
  const [openId, setOpenId] = useState<string | null>(null);
  if (!team.data?.length) return null;
  return (
    <section className='space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4'>
      <h2 className='text-sm font-semibold text-slate-700'>Leaving</h2>
      <ul className='space-y-2'>
        {team.data.map((x) => {
          const todo =
            x.can.acknowledge || x.can.clear.includes('manager')
              ? x.can.acknowledge
                ? 'Acknowledge and write the handover plan'
                : 'Clear the handover'
              : null;
          return (
            <li key={x.id} className='rounded-lg border border-slate-200 bg-white'>
              <button
                type='button'
                onClick={() => setOpenId(openId === x.id ? null : x.id)}
                className='flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left'
              >
                <span className='font-medium text-slate-800'>{x.employee.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${EXIT_STATUS_CLASS[x.status]}`}>
                  {EXIT_STATUS_LABELS[x.status]}
                </span>
                <span className='text-xs text-slate-500'>
                  Last day{' '}
                  {longDay(x.status === 'submitted' ? x.proposedLastDay : x.lastWorkingDay)}
                </span>
                {todo && <span className='ml-auto text-xs font-medium text-amber-800'>{todo}</span>}
              </button>
              {openId === x.id && (
                <div className='border-t border-slate-100 p-4'>
                  <ExitCard
                    exit={x}
                    showPerson={false}
                    onChanged={() => queryClient.invalidateQueries({ queryKey: ['team-exits'] })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default TeamExits;

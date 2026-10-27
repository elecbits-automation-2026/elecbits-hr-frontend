import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { RequisitionStatus } from '@app-types/api.types';
import RequisitionCard from '@components/Common/Hiring/RequisitionCard.component';
import LineWorkspace from '@components/Ta/Hiring/LineWorkspace.component';
import { REQ_STATUS_LABEL } from '@constants/Common/hiring.constants';
import { hiringApi } from '@services/api/hiring.api';
import { apiErrorMessage } from '@utils/apiError';

const btn =
  'rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50';

const FILTERS: Array<RequisitionStatus | ''> = [
  '',
  'queued',
  'submitted',
  'approved',
  'returned',
  'draft',
  'cancelled',
];

/**
 * TA / HR view of every hiring line: what departments asked for and where each
 * approval stands. An approved line opens TA's workspace (Step C): positions →
 * recruiters, and the JD + scorecard. Candidates arrive in the next step.
 */
const HiringPage = () => {
  const [status, setStatus] = useState<RequisitionStatus | ''>('submitted');
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['hiring-requisitions', status],
    queryFn: () => hiringApi.list(status || undefined),
  });

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Requisitions</h1>
          <p className='text-sm text-slate-500'>
            Hiring lines from department heads, and where their approvals stand.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-1'>
          {FILTERS.map((f) => (
            <button
              key={f || 'all'}
              type='button'
              onClick={() => setStatus(f)}
              className={`rounded-full px-3 py-1 text-xs ${
                status === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'queued' ? 'Queued' : f ? REQ_STATUS_LABEL[f].split(' —')[0] : 'All'}
            </button>
          ))}
        </div>
      </div>
      {list.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {list.error && <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>}
      {list.data?.length === 0 && (
        <p className='rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>
          No lines here.
        </p>
      )}
      <div className='space-y-3'>
        {list.data?.map((r) => (
          <RequisitionCard
            key={r.id}
            req={r}
            showDepartment
            actions={
              r.status === 'approved' &&
              (open === r.id ? (
                <>
                  <LineWorkspace req={r} />
                  <button type='button' onClick={() => setOpen(null)} className={btn}>
                    Close
                  </button>
                </>
              ) : (
                <button type='button' onClick={() => setOpen(r.id)} className={btn}>
                  Positions, JD + scorecard
                </button>
              ))
            }
          />
        ))}
      </div>
    </div>
  );
};

export default HiringPage;

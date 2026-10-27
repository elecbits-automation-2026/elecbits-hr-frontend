import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { InterviewRound, Position, Requisition } from '@app-types/api.types';
import AddCandidateDialog from '@components/Ta/Hiring/AddCandidateDialog.component';
import ApplicationRow from '@components/Ta/Hiring/ApplicationRow.component';
import { ROUND_LABEL } from '@constants/Common/hiring.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { concernsApi } from '@services/api/concerns.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';

/** Pick someone already in the talent pool. */
const PoolPicker = ({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) => {
  const [q, setQ] = useState('');
  const pool = useQuery({
    queryKey: ['candidates', q],
    queryFn: () => candidatesApi.list(q.trim() || undefined),
  });
  return (
    <div className='space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3'>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder='Search the talent pool by name, email or phone'
        className={input}
      />
      <ul className='max-h-56 space-y-1 overflow-y-auto'>
        {pool.data
          ?.filter((c) => !c.anonymised)
          .map((c) => (
            <li key={c.id} className='flex items-center justify-between gap-2 text-sm'>
              <span>
                {c.name}{' '}
                <span className='text-xs text-slate-400'>
                  {c.applications.length
                    ? `${c.applications.length} earlier application(s)`
                    : 'no applications yet'}
                </span>
              </span>
              <button type='button' onClick={() => onPick(c.id)} className={btn}>
                Add to this position
              </button>
            </li>
          ))}
      </ul>
      <div className='flex justify-end'>
        <button type='button' onClick={onClose} className={btn}>
          Close
        </button>
      </div>
    </div>
  );
};

/**
 * One open position's candidates (TA Step D): add someone new or from the
 * talent pool, then move them along — shortlist, interviews, scores.
 */
export const PositionPipeline = ({ position }: { position: Position }) => {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<'new' | 'pool' | null>(null);
  const pipeline = useQuery({
    queryKey: ['pipeline', position.id],
    queryFn: () => candidatesApi.pipeline(position.id),
  });
  const apply = useMutation({
    mutationFn: (candidateId: string) => candidatesApi.apply(position.id, candidateId),
    onSuccess: () => {
      setAdding(null);
      queryClient.invalidateQueries({ queryKey: ['pipeline', position.id] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
  });

  return (
    <div className='space-y-2'>
      {pipeline.data?.length === 0 && <p className='text-xs text-slate-400'>No candidates yet.</p>}
      {pipeline.data?.map((a) => (
        <ApplicationRow key={a.id} app={a} />
      ))}
      {apply.error && <p className='text-xs text-red-600'>{apiErrorMessage(apply.error)}</p>}
      {adding === 'pool' && (
        <PoolPicker onPick={(id) => apply.mutate(id)} onClose={() => setAdding(null)} />
      )}
      {adding === 'new' && (
        <AddCandidateDialog onDone={(id) => apply.mutate(id)} onClose={() => setAdding(null)} />
      )}
      {!adding && (
        <div className='flex justify-end gap-2'>
          <button type='button' onClick={() => setAdding('pool')} className={btn}>
            From the talent pool
          </button>
          <button
            type='button'
            onClick={() => setAdding('new')}
            className='rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700'
          >
            Add a new candidate
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * The line's interview rounds and who conducts them; TA can swap an
 * interviewer (the department head is told). HR rounds left blank go to the
 * position's recruiter.
 */
export const InterviewerList = ({ req }: { req: Requisition }) => {
  const queryClient = useQueryClient();
  const directory = useQuery({
    queryKey: ['concern-people'],
    queryFn: concernsApi.people,
    staleTime: 5 * 60_000,
  });
  const [editing, setEditing] = useState<InterviewRound | null>(null);
  const [pick, setPick] = useState('');
  const swap = useMutation({
    mutationFn: (round: InterviewRound) => candidatesApi.swapInterviewer(req.id, round, pick),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
  return (
    <div className='space-y-1.5'>
      <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>Interviewers</p>
      {req.rounds.map((r) => (
        <div key={r.round} className='flex flex-wrap items-center justify-between gap-2 text-sm'>
          <span className='text-slate-700'>
            {ROUND_LABEL[r.round]} ·{' '}
            {r.interviewerName ??
              (r.round === 'hr' || r.round === 'hr_final' ? 'the recruiter' : 'not named yet')}
          </span>
          {editing === r.round ? (
            <span className='flex gap-2'>
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className='rounded-md border border-slate-300 px-2 py-1 text-xs'
              >
                <option value=''>Who?</option>
                {directory.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type='button'
                disabled={!pick || swap.isPending}
                onClick={() => swap.mutate(r.round)}
                className={btn}
              >
                Save
              </button>
              <button type='button' onClick={() => setEditing(null)} className={btn}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type='button'
              onClick={() => {
                swap.reset();
                setPick('');
                setEditing(r.round);
              }}
              className={btn}
            >
              {r.interviewerId ? 'Swap' : 'Name'}
            </button>
          )}
        </div>
      ))}
      {swap.error && <p className='text-xs text-red-600'>{apiErrorMessage(swap.error)}</p>}
    </div>
  );
};

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import PipCard from '@components/Common/Pip/PipCard.component';
import StartPip from '@components/Common/Pip/StartPip.component';
import { pipApi } from '@services/api/pip.api';
import { useAuthStore } from '@store/auth.store';
import { apiErrorMessage } from '@utils/apiError';

const OPEN = new Set(['pending_hr', 'active']);

/**
 * One person's PIPs on their sheet. The RM (`canStart`) may open one when
 * none is running; a poor quarter score only rings the RM — never auto-starts.
 */
export const PersonPips = ({
  employeeId,
  canStart,
  pipCandidate,
}: {
  employeeId: string;
  canStart: boolean;
  pipCandidate: string | null;
}) => {
  const pips = useQuery({
    queryKey: ['pips', employeeId],
    queryFn: () => pipApi.list(employeeId),
  });
  const [starting, setStarting] = useState(false);
  if (pips.error) return <p className='text-sm text-slate-400'>{apiErrorMessage(pips.error)}</p>;
  const list = pips.data ?? [];
  const open = list.some((p) => OPEN.has(p.status));
  return (
    <div className='space-y-3'>
      {pipCandidate && !open && (
        <p className='text-sm text-red-700'>
          {pipCandidate} closed under 50 — consider a performance improvement plan.
        </p>
      )}
      {list.length === 0 && !starting && <p className='text-sm text-slate-500'>No PIP.</p>}
      {list.map((p) => (
        <PipCard key={p.id} pip={p} />
      ))}
      {canStart && !open && !starting && (
        <button
          type='button'
          onClick={() => setStarting(true)}
          className='text-xs font-medium text-brand-700 hover:underline'
        >
          Start a PIP
        </button>
      )}
      {starting && <StartPip employeeId={employeeId} onDone={() => setStarting(false)} />}
    </div>
  );
};

/** My performance: the employee's own plan, to read and acknowledge. */
export const MyPips = () => {
  const me = useAuthStore((s) => s.user?.employeeId);
  const pips = useQuery({ queryKey: ['pips', 'mine'], queryFn: () => pipApi.list(me) });
  const mine = (pips.data ?? []).filter((p) => p.employee.id === me && p.status !== 'cancelled');
  if (mine.length === 0) return null;
  return (
    <section className='space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-5'>
      <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
        Performance improvement plan
      </h2>
      {mine.map((p) => (
        <PipCard key={p.id} pip={p} />
      ))}
    </section>
  );
};

/** HR: plans waiting for approval, and the ones running. */
export const PipQueue = () => {
  const pips = useQuery({ queryKey: ['pips', 'queue'], queryFn: () => pipApi.list() });
  const list = pips.data ?? [];
  const waiting = list.filter((p) => p.status === 'pending_hr');
  const running = list.filter((p) => p.status === 'active');
  return (
    <section className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'>
      <h2 className='text-sm font-semibold text-slate-700'>Performance improvement plans</h2>
      {pips.error && <p className='text-sm text-red-600'>{apiErrorMessage(pips.error)}</p>}
      {waiting.length === 0 && running.length === 0 && (
        <p className='text-sm text-slate-500'>No PIP is waiting or running.</p>
      )}
      {waiting.length > 0 && (
        <>
          <p className='text-xs font-semibold uppercase tracking-wide text-amber-700'>
            Waiting for your approval
          </p>
          {waiting.map((p) => (
            <PipCard key={p.id} pip={p} showPerson />
          ))}
        </>
      )}
      {running.length > 0 && (
        <>
          <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Running</p>
          {running.map((p) => (
            <PipCard key={p.id} pip={p} showPerson />
          ))}
        </>
      )}
    </section>
  );
};

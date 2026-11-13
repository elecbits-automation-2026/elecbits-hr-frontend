import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import PipCard from '@components/Common/Pip/PipCard.component';
import StartPip from '@components/Common/Pip/StartPip.component';
import { pipApi } from '@services/api/pip.api';
import { useAuthStore } from '@store/auth.store';
import { apiErrorMessage } from '@utils/apiError';

const OPEN = new Set(['pending_hr', 'active']);

/**
 * One person's PIPs on their sheet. Their RM (or HR, when they have no RM)
 * may open one when none is running — the server says who — always their own
 * decision, never suggested by a score.
 */
export const PersonPips = ({ employeeId }: { employeeId: string }) => {
  const pips = useQuery({
    queryKey: ['pips', employeeId],
    queryFn: () => pipApi.list(employeeId),
  });
  const may = useQuery({
    queryKey: ['pips', 'can-start', employeeId],
    queryFn: () => pipApi.canStart(employeeId),
  });
  const canStart = may.data === true;
  const [starting, setStarting] = useState(false);
  if (pips.error) return <p className='text-sm text-slate-400'>{apiErrorMessage(pips.error)}</p>;
  const list = pips.data ?? [];
  const open = list.some((p) => OPEN.has(p.status));
  return (
    <div className='space-y-3'>
      {canStart && !open && !starting && (
        <button
          type='button'
          onClick={() => setStarting(true)}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
        >
          Start a PIP
        </button>
      )}
      {starting && <StartPip employeeId={employeeId} onDone={() => setStarting(false)} />}
      {list.length === 0 && !starting && <p className='text-sm text-slate-500'>No PIP.</p>}
      {list.map((p) => (
        <PipCard key={p.id} pip={p} />
      ))}
    </div>
  );
};

/** My performance: the employee's own plan, to read. */
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

/** HR: the plans running for the people they reach (for information — RMs run them). */
export const PipQueue = () => {
  const pips = useQuery({ queryKey: ['pips', 'queue'], queryFn: () => pipApi.list() });
  const running = (pips.data ?? []).filter((p) => p.status === 'active');
  return (
    <section className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'>
      <h2 className='text-sm font-semibold text-slate-700'>
        Running performance improvement plans
      </h2>
      {pips.error && <p className='text-sm text-red-600'>{apiErrorMessage(pips.error)}</p>}
      {pips.data && running.length === 0 && (
        <p className='text-sm text-slate-500'>No PIP is running.</p>
      )}
      {running.map((p) => (
        <PipCard key={p.id} pip={p} showPerson />
      ))}
    </section>
  );
};

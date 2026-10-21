import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Exit, ExitStatus } from '@app-types/api.types';
import ExitCard from '@components/Common/Exits/ExitCard.component';
import {
  EXIT_STATUS_CLASS,
  EXIT_STATUS_LABELS,
  addDays,
  isoToday,
  longDay,
} from '@constants/Common/exits.constants';
import { employeesApi } from '@services/api/employees.api';
import { exitsApi } from '@services/api/exits.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';
import { holdsPortal } from '@utils/sections';

type Tab = 'submitted' | 'accepted' | 'relieved' | 'closed';
const TAB_LABELS: Record<Tab, string> = {
  submitted: 'Waiting for HR',
  accepted: 'Serving notice',
  relieved: 'Left — F&F pending',
  closed: 'Closed',
};
const inTab = (t: Tab, s: ExitStatus) =>
  t === 'closed' ? !['submitted', 'accepted', 'relieved'].includes(s) : s === t;

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const primary =
  'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40';
const secondary =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40';

/** HR ends someone's employment: serve the notice, or leave earlier with it paid in lieu. */
const TerminateModal = ({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (e: Exit) => void;
}) => {
  const people = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const [employeeId, setEmployeeId] = useState('');
  const [mode, setMode] = useState<'serve' | 'pay_in_lieu'>('serve');
  const [lastDay, setLastDay] = useState('');
  const [reason, setReason] = useState('');
  const person = people.data?.find((p) => p.id === employeeId);
  const notice = person?.noticeDays ?? 0;
  const go = useMutation({
    mutationFn: () =>
      exitsApi.terminate({ employeeId, reason: reason.trim(), mode, lastWorkingDay: lastDay }),
    onSuccess: onDone,
  });
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-lg space-y-3 rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>Start a termination</h2>
        <select
          value={employeeId}
          onChange={(e) => {
            setEmployeeId(e.target.value);
            const p = people.data?.find((x) => x.id === e.target.value);
            setLastDay(addDays(isoToday(), p?.noticeDays ?? 0));
          }}
          className={input}
        >
          <option value=''>Who?</option>
          {people.data
            ?.filter((p) => p.status === 'active')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.employeeCode}
              </option>
            ))}
        </select>
        {person && (
          <p className='text-xs text-slate-500'>
            Notice on record: {notice} days — serving it means a last day on or after{' '}
            {longDay(addDays(isoToday(), notice))}.
          </p>
        )}
        <div className='flex gap-4 text-sm text-slate-700'>
          <label className='flex items-center gap-1.5'>
            <input type='radio' checked={mode === 'serve'} onChange={() => setMode('serve')} />
            Serve the notice
          </label>
          <label className='flex items-center gap-1.5'>
            <input
              type='radio'
              checked={mode === 'pay_in_lieu'}
              onChange={() => setMode('pay_in_lieu')}
            />
            Leave earlier — pay the notice in lieu
          </label>
        </div>
        <label className='block space-y-1'>
          <span className='text-xs text-slate-500'>Last working day</span>
          <input
            type='date'
            min={isoToday()}
            value={lastDay}
            onChange={(e) => setLastDay(e.target.value)}
            className={`${input} max-w-xs`}
          />
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='Reason (they see this)'
          className={input}
        />
        {go.error && <p className='text-sm text-red-600'>{apiErrorMessage(go.error)}</p>}
        <div className='flex justify-end gap-2'>
          <button type='button' onClick={onClose} className={secondary}>
            Cancel
          </button>
          <button
            type='button'
            disabled={!employeeId || !lastDay || reason.trim().length < 10 || go.isPending}
            onClick={() => go.mutate()}
            className={primary}
          >
            Start termination
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * HR → Exits: every resignation and termination by stage. HR accepts and
 * clears; OPS clears assets on the last day; payroll adds recovery lines —
 * each sees the actions the server allows them in the drawer.
 */
const ExitsPage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('submitted');
  const [openId, setOpenId] = useState<string | null>(null);
  const [terminating, setTerminating] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const list = useQuery({ queryKey: ['exits'], queryFn: exitsApi.list });
  const open = useQuery({
    queryKey: ['exit', openId],
    queryFn: () => exitsApi.get(openId!),
    enabled: !!openId,
  });
  const refresh = (e?: Exit) => {
    if (e) queryClient.setQueryData(['exit', e.id], e);
    queryClient.invalidateQueries({ queryKey: ['exits'] });
    queryClient.invalidateQueries({ queryKey: ['exit', openId] });
  };
  const rows = (list.data ?? []).filter((x) => inTab(tab, x.status));
  const isHr = !!me.data && holdsPortal(me.data, 'HRBP');

  return (
    <div className='w-full max-w-5xl space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Exits</h1>
          <p className='text-sm text-slate-500'>
            Resignations and terminations. HR accepts and fixes the last day; HR, the manager and
            OPS clear; the full & final rides the next monthly payroll run.
          </p>
        </div>
        {isHr && (
          <button type='button' onClick={() => setTerminating(true)} className={secondary}>
            Start a termination
          </button>
        )}
      </div>
      <div className='flex flex-wrap gap-1 border-b border-slate-200'>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const n = (list.data ?? []).filter((x) => inTab(t, x.status)).length;
          return (
            <button
              key={t}
              type='button'
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                tab === t
                  ? 'border-brand-600 font-medium text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {TAB_LABELS[t]}
              {t !== 'closed' && n > 0 && (
                <span className='ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800'>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {list.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
      {list.error && <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>}
      {list.data && rows.length === 0 && (
        <p className='rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400'>
          Nothing here.
        </p>
      )}
      {rows.length > 0 && (
        <ul className='divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white'>
          {rows.map((x) => {
            const done = x.clearances.filter((c) => c.clearedAt).length;
            return (
              <li key={x.id}>
                <button
                  type='button'
                  onClick={() => setOpenId(x.id)}
                  className='flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-slate-50'
                >
                  <span className='font-medium text-slate-800'>{x.employee.name}</span>
                  <span className='text-xs text-slate-400'>
                    {x.kind === 'resignation' ? 'Resignation' : 'Termination'}
                    {x.employee.department ? ` · ${x.employee.department}` : ''}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${EXIT_STATUS_CLASS[x.status]}`}
                  >
                    {EXIT_STATUS_LABELS[x.status]}
                  </span>
                  <span className='ml-auto text-xs text-slate-500'>
                    Last day{' '}
                    {longDay(x.status === 'submitted' ? x.proposedLastDay : x.lastWorkingDay)} ·{' '}
                    {done}/4 cleared
                    {x.can.clear.length > 0 ? ' · your clearance pending' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {terminating && (
        <TerminateModal
          onClose={() => setTerminating(false)}
          onDone={(e) => {
            setTerminating(false);
            setTab('accepted');
            refresh(e);
            setOpenId(e.id);
          }}
        />
      )}
      {openId && (
        <div className='fixed inset-0 z-50 flex justify-end bg-slate-900/30'>
          <button
            type='button'
            aria-label='Close'
            className='flex-1 cursor-default'
            onClick={() => setOpenId(null)}
          />
          <div className='h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl'>
            <div className='mb-4 flex justify-end'>
              <button
                type='button'
                onClick={() => setOpenId(null)}
                className='text-sm text-slate-500 hover:text-slate-800'
              >
                Close ✕
              </button>
            </div>
            {open.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
            {open.error && <p className='text-sm text-red-600'>{apiErrorMessage(open.error)}</p>}
            {open.data && <ExitCard key={open.data.id} exit={open.data} onChanged={refresh} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExitsPage;

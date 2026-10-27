import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Seat, SeatKind, VacantSeat } from '@app-types/api.types';
import { employeesApi } from '@services/api/employees.api';
import { seatsApi } from '@services/api/seats.api';
import { apiErrorMessage } from '@utils/apiError';

const SEAT_LABEL: Record<SeatKind, string> = {
  dept_head: 'Department head',
  vp_hr_head: 'VP',
};

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

/** A seat slot, held or empty — what a row of the page is about. */
interface Slot {
  seat: SeatKind;
  departmentId: string | null;
  departmentName: string | null;
  holder: Seat | null;
}

const slotTitle = (s: Slot) =>
  s.seat === 'dept_head' ? (s.departmentName ?? 'Department') : SEAT_LABEL[s.seat];

const AssignDialog = ({
  slot,
  ownerId,
  onClose,
}: {
  slot: Slot;
  ownerId: string | null;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const people = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const [employeeId, setEmployeeId] = useState('');
  // A replacement after the head left is usually a stand-in.
  const [acting, setActing] = useState(slot.holder === null);
  const go = useMutation({
    mutationFn: () =>
      seatsApi.assign({
        seat: slot.seat,
        departmentId: slot.departmentId ?? undefined,
        employeeId,
        acting,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seats'] });
      onClose();
    },
  });
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>
          {SEAT_LABEL[slot.seat]}
          {slot.seat === 'dept_head' && ` · ${slot.departmentName}`}
        </h2>
        {slot.holder && (
          <p className='text-xs text-slate-500'>
            Held by {slot.holder.employeeName} — assigning someone else ends their tenure (kept in
            history).
          </p>
        )}
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className={input}
        >
          <option value=''>Who?</option>
          {people.data
            ?.filter((p) => p.status === 'active' && p.id !== ownerId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.employeeCode}
              </option>
            ))}
        </select>
        <label className='flex items-center gap-1.5 text-sm text-slate-700'>
          <input type='checkbox' checked={acting} onChange={(e) => setActing(e.target.checked)} />
          Acting (standing in until a permanent holder is named)
        </label>
        {go.error && <p className='text-sm text-red-600'>{apiErrorMessage(go.error)}</p>}
        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={!employeeId || go.isPending}
            onClick={() => go.mutate()}
            className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50'
          >
            {go.isPending ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SlotRow = ({ slot, onAssign }: { slot: Slot; onAssign: (s: Slot) => void }) => {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const vacate = useMutation({
    mutationFn: () =>
      seatsApi.vacate({ seat: slot.seat, departmentId: slot.departmentId ?? undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seats'] }),
  });
  return (
    <tr className='border-t border-slate-100'>
      <td className='px-4 py-2 font-medium text-slate-800'>{slotTitle(slot)}</td>
      <td className='px-4 py-2'>
        {slot.holder ? (
          <span className='flex items-center gap-2'>
            {slot.holder.employeeName}
            {slot.holder.acting && (
              <span className='rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-700'>
                acting
              </span>
            )}
          </span>
        ) : (
          <span className='text-slate-400'>Empty</span>
        )}
      </td>
      <td className='px-4 py-2 text-xs text-slate-400'>
        {slot.holder ? new Date(slot.holder.startedAt).toLocaleDateString('en-IN') : ''}
      </td>
      <td className='px-4 py-2 text-right'>
        {vacate.error && (
          <span className='mr-2 text-xs text-red-600'>{apiErrorMessage(vacate.error)}</span>
        )}
        <button
          type='button'
          onClick={() => onAssign(slot)}
          className='rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50'
        >
          {slot.holder ? 'Replace' : 'Assign'}
        </button>
        {slot.holder &&
          (confirming ? (
            <button
              type='button'
              disabled={vacate.isPending}
              onClick={() => vacate.mutate()}
              onBlur={() => setConfirming(false)}
              className='ml-2 rounded-md bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50'
            >
              Confirm vacate
            </button>
          ) : (
            <button
              type='button'
              onClick={() => setConfirming(true)}
              className='ml-2 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50'
            >
              Vacate
            </button>
          ))}
      </td>
    </tr>
  );
};

const toSlot = (v: VacantSeat): Slot => ({ ...v, holder: null });
const heldSlot = (s: Seat): Slot => ({
  seat: s.seat,
  departmentId: s.departmentId,
  departmentName: s.departmentName,
  holder: s,
});

/**
 * Seats the Admin account assigns — department heads and the VP (TA design). Nothing is derived from level or designation; a leaver's
 * seats end at relieve and show up here as empty.
 */
const SeatsPage = () => {
  const overview = useQuery({ queryKey: ['seats'], queryFn: seatsApi.overview });
  const [assigning, setAssigning] = useState<Slot | null>(null);

  if (overview.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (overview.error)
    return <p className='text-sm text-red-600'>{apiErrorMessage(overview.error)}</p>;
  if (!overview.data) return null;

  const { seats, vacant } = overview.data;
  const byName = (a: Slot, b: Slot) => slotTitle(a).localeCompare(slotTitle(b));
  const company = [...seats.filter((s) => s.seat !== 'dept_head').map(heldSlot)]
    .concat(vacant.filter((v) => v.seat !== 'dept_head').map(toSlot))
    .sort((a, b) => a.seat.localeCompare(b.seat));
  const departments = [...seats.filter((s) => s.seat === 'dept_head').map(heldSlot)]
    .concat(vacant.filter((v) => v.seat === 'dept_head').map(toSlot))
    .sort(byName);

  const table = (title: string, slots: Slot[]) => (
    <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white'>
      <table className='w-full text-sm'>
        <thead className='bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500'>
          <tr>
            <th className='px-4 py-2'>{title}</th>
            <th className='px-4 py-2'>Held by</th>
            <th className='px-4 py-2'>Since</th>
            <th className='px-4 py-2' />
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <SlotRow key={`${s.seat}:${s.departmentId ?? ''}`} slot={s} onAssign={setAssigning} />
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className='w-full space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Seats</h1>
        <p className='text-sm text-slate-500'>
          Who heads each department, and who is VP. Assigned by Admin only, here — never from
          level or designation. The HR head is simply the head of the HR department.
        </p>
      </div>

      {vacant.length > 0 && (
        <div className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
          {vacant.length} empty seat{vacant.length === 1 ? '' : 's'}:{' '}
          {vacant.map((v) => slotTitle(toSlot(v))).join(', ')}. Steps waiting on a department head
          stay paused until one is assigned.
        </div>
      )}

      {table('Company seat', company)}
      {table('Department', departments)}

      {assigning && (
        <AssignDialog
          slot={assigning}
          ownerId={overview.data.ownerEmployeeId}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
};

export default SeatsPage;

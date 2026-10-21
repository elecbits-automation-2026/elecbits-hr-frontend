import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateLeaveRequestInput, LeaveDayPart, LeaveType } from '@app-types/api.types';
import { LEAVE_TYPE_LABELS } from '@constants/Common/leaves/leave.constants';
import { usePublicSettings } from '@hooks/Common/usePublicSettings.hook';
import { leavesApi } from '@services/api/leaves.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

/**
 * Raise a leave: full days are a range; a half day collapses to one date plus
 * which half. The backend recomputes days and enforces overlap/balance rules —
 * this form only collects the request. `types` comes from the balances
 * response, so a type the caller isn't entitled to (menstrual) never shows.
 */
const RaiseLeaveModal = ({ types, onClose }: { types: LeaveType[]; onClose: () => void }) => {
  const queryClient = useQueryClient();

  const [type, setType] = useState<LeaveType>(types[0] ?? 'sick');
  const [half, setHalf] = useState(false);
  const [dayPart, setDayPart] = useState<Exclude<LeaveDayPart, 'full'>>('first_half');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const { leaveWindowDays } = usePublicSettings();
  // Planned leave has to be raised ahead (the backend enforces the same rule).
  const noticeDays =
    type === 'earned' || type === 'vacation_family' ? leaveWindowDays[type] : 0;
  const earliest =
    noticeDays > 0
      ? new Date(Date.now() + noticeDays * 86_400_000).toLocaleDateString('en-CA')
      : undefined;

  const create = useMutation({
    mutationFn: leavesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: CreateLeaveRequestInput = {
      type,
      startDate,
      endDate: half ? startDate : endDate,
      dayPart: half ? dayPart : 'full',
    };
    if (reason.trim()) input.reason = reason.trim();
    create.mutate(input);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <form
        onSubmit={submit}
        className='max-h-full w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
      >
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>Request leave</h2>
          <button
            type='button'
            onClick={onClose}
            className='text-sm text-slate-400 hover:text-slate-600'
          >
            ✕
          </button>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
              className={inputClass}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {LEAVE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Duration</label>
            <select
              value={half ? 'half' : 'full'}
              onChange={(e) => setHalf(e.target.value === 'half')}
              className={inputClass}
            >
              <option value='full'>Full day(s)</option>
              <option value='half'>Half day</option>
            </select>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>{half ? 'Date' : 'From'}</label>
            <input
              type='date'
              required
              min={earliest}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          {half ? (
            <div className='space-y-1'>
              <label className={labelClass}>Which half</label>
              <select
                value={dayPart}
                onChange={(e) => setDayPart(e.target.value as Exclude<LeaveDayPart, 'full'>)}
                className={inputClass}
              >
                <option value='first_half'>First half</option>
                <option value='second_half'>Second half</option>
              </select>
            </div>
          ) : (
            <div className='space-y-1'>
              <label className={labelClass}>To</label>
              <input
                type='date'
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        </div>

        <p className='text-xs text-slate-400'>
          Weekends and company holidays inside the range don’t count — Fri→Mon costs 2 days.
        </p>
        {noticeDays > 0 && (
          <p className='text-xs text-amber-700'>
            {LEAVE_TYPE_LABELS[type]} must be applied for at least {noticeDays} days before it
            starts.
          </p>
        )}

        <div className='space-y-1'>
          <label className={labelClass}>Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputClass} min-h-20`}
          />
        </div>

        {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}

        <div className='flex justify-end gap-2 pt-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={create.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {create.isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RaiseLeaveModal;

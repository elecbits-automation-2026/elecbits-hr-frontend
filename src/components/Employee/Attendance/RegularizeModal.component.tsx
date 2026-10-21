import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { usePublicSettings } from '@hooks/Common/usePublicSettings.hook';
import { attendanceApi } from '@services/api/attendance.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

/** Combine a YYYY-MM-DD date and HH:mm time into an ISO instant (local time). */
const toIso = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

/**
 * "Fix my punch": propose in/out times for a recent day (forgot to punch,
 * client visit). The RM approves; approval writes the attendance row.
 */
const RegularizeModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [inTime, setInTime] = useState('09:30');
  const [outTime, setOutTime] = useState('18:30');
  const [reason, setReason] = useState('');
  const { regularizeWindowDays } = usePublicSettings();
  // Earliest correctable day, local time — the backend enforces the same window.
  const minDate = new Date(Date.now() - regularizeWindowDays * 86_400_000).toLocaleDateString('en-CA');
  const maxDate = new Date().toLocaleDateString('en-CA');

  const create = useMutation({
    mutationFn: attendanceApi.raiseRegularization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-regularizations'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({
      date,
      proposedIn: toIso(date, inTime),
      proposedOut: toIso(date, outTime),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <form
        onSubmit={submit}
        className='max-h-full w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
      >
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>Regularize a day</h2>
          <button type='button' onClick={onClose} className='text-sm text-slate-400 hover:text-slate-600'>
            ✕
          </button>
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Date (last {regularizeWindowDays} days)</label>
          <input type='date' required min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>In</label>
            <input type='time' required value={inTime} onChange={(e) => setInTime(e.target.value)} className={inputClass} />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Out</label>
            <input type='time' required value={outTime} onChange={(e) => setOutTime(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className='space-y-1'>
          <label className={labelClass}>Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} min-h-16`} />
        </div>

        {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}

        <div className='flex justify-end gap-2 pt-2'>
          <button type='button' onClick={onClose} className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'>
            Cancel
          </button>
          <button
            type='submit'
            disabled={create.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {create.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegularizeModal;

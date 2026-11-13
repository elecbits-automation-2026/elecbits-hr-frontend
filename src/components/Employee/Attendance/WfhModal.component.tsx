import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { attendanceApi } from '@services/api/attendance.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

/**
 * Request remote work for a date range. A reason is MANDATORY (client visit,
 * WFH, field work…). The RM alone approves; from the moment it is raised the
 * person may punch from outside the office zones, and a decline turns those
 * days absent (learner, 2026-11-05).
 */
const WfhModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  // Remote work is never for days gone by (the server refuses them too).
  const today = new Date().toLocaleDateString('en-CA');

  const create = useMutation({
    mutationFn: attendanceApi.raiseWfh,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-wfh'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({
      startDate,
      endDate: endDate || startDate,
      reason: reason.trim(),
    });
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <form
        onSubmit={submit}
        className='max-h-full w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
      >
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>Request remote work</h2>
          <button type='button' onClick={onClose} className='text-sm text-slate-400 hover:text-slate-600'>
            ✕
          </button>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>From</label>
            <input type='date' required min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>To</label>
            <input type='date' min={startDate || today} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className='space-y-1'>
          <label className={labelClass}>Reason (required)</label>
          <textarea
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='e.g. client visit at Acme Pune, WFH — plumber coming'
            className={`${inputClass} min-h-16`}
          />
          <p className='text-xs text-slate-400'>
            You can clock in and out from anywhere as soon as you send this. Your RM approves it —
            if they decline, those days count as absent.
          </p>
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

export default WfhModal;

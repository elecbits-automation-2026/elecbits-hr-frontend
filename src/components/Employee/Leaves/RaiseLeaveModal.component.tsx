import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateLeaveRequestInput, LeaveDayPart, LeaveType } from '@app-types/api.types';
import { LEAVE_TYPE_LABELS } from '@constants/Common/leaves/leave.constants';
import { usePublicSettings } from '@hooks/Common/usePublicSettings.hook';
import { leavesApi } from '@services/api/leaves.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

/** Sick leave of MORE than this many days needs the certificate up front (backend SICK_CERT_AFTER_DAYS). */
const SICK_CERT_AFTER_DAYS = 3;
const CERT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const CERT_MAX_BYTES = 10 * 1024 * 1024;

/** Mon–Fri days in the range — a quick floor of what the backend will count. */
const weekdaysBetween = (from: string, to: string): number => {
  if (!from || !to || to < from) return 0;
  let n = 0;
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n += 1;
  }
  return n;
};

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
  const [certificate, setCertificate] = useState<File | null>(null);
  const { leaveWindowDays } = usePublicSettings();
  // Sick leave of more than 3 days: the medical certificate goes with the
  // request (learner, 2026-11-05); it can't be approved without one.
  const sickLong =
    type === 'sick' && !half && weekdaysBetween(startDate, endDate) > SICK_CERT_AFTER_DAYS;
  const certProblem =
    certificate === null
      ? null
      : !CERT_TYPES.includes(certificate.type)
        ? 'The certificate must be a PDF, JPG or PNG'
        : certificate.size > CERT_MAX_BYTES
          ? 'The certificate must be 10 MB or smaller'
          : null;
  // Planned leave has to be raised ahead (the backend enforces the same rule).
  const noticeDays =
    type === 'earned' || type === 'vacation_family' ? leaveWindowDays[type] : 0;
  const earliest =
    noticeDays > 0
      ? new Date(Date.now() + noticeDays * 86_400_000).toLocaleDateString('en-CA')
      : undefined;

  const create = useMutation({
    mutationFn: async (input: CreateLeaveRequestInput) => {
      const leave = await leavesApi.create(input);
      if (type === 'sick' && certificate) {
        try {
          await leavesApi.uploadCertificate(leave.id, certificate);
        } catch (err) {
          throw new Error(
            `The leave was sent but the certificate didn't upload (${apiErrorMessage(err)}). Attach it from Leave — it can't be approved without one.`,
          );
        }
      } else if (leave.certificateNeeded) {
        throw new Error(
          'The leave was sent, but it needs a medical certificate before it can be approved — attach it from Leave.',
        );
      }
      return leave;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
    },
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

        {type === 'sick' && (
          <div className='space-y-1'>
            <label className={labelClass}>
              Medical certificate{' '}
              {sickLong
                ? `(required — sick leave of more than ${SICK_CERT_AFTER_DAYS} days)`
                : '(optional)'}
            </label>
            <input
              type='file'
              accept={CERT_TYPES.join(',')}
              onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
              className='block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200'
            />
            {certProblem && <p className='text-xs text-red-600'>{certProblem}</p>}
          </div>
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
            disabled={create.isPending || certProblem !== null || (sickLong && !certificate)}
            title={sickLong && !certificate ? 'Attach the medical certificate first' : undefined}
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

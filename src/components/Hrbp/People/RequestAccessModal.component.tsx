import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Employee } from '@app-types/api.types';
import { accessApi } from '@services/api/access.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * HR asks Admin for extra access for ONE person (§5.5): pick the batches,
 * explain the role. Admin approves, approves part of it, or declines; the
 * bell reports the outcome to you and to the person.
 */
const RequestAccessModal = ({ employee, onClose }: { employee: Employee; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const options = useQuery({
    queryKey: ['grant-request-options'],
    queryFn: accessApi.requestableBatches,
  });

  const create = useMutation({
    mutationFn: () =>
      accessApi.createGrantRequest({
        employeeId: employee.id,
        note: note.trim(),
        items: picked.map((batchId) => ({ kind: 'batch' as const, batchId })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-grant-requests'] });
      setSent(true);
    },
  });

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
        className='max-h-full w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
      >
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>
            Request access for {employee.name}
          </h2>
          <button
            type='button'
            onClick={onClose}
            className='text-sm text-slate-400 hover:text-slate-600'
          >
            ✕
          </button>
        </div>

        {sent ? (
          <>
            <p className='text-sm text-slate-600'>
              Sent to Admin. You&rsquo;ll get a notification when it&rsquo;s decided.
            </p>
            <div className='flex justify-end'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className='space-y-1.5'>
              <p className='text-xs font-medium text-slate-600'>Access to propose</p>
              {options.error && (
                <p className='text-sm text-red-600'>{apiErrorMessage(options.error)}</p>
              )}
              {options.data?.map((b) => (
                <label key={b.id} className='flex items-start gap-2 text-sm text-slate-700'>
                  <input
                    type='checkbox'
                    checked={picked.includes(b.id)}
                    onChange={() => toggle(b.id)}
                    className='mt-0.5 h-4 w-4'
                  />
                  <span>
                    {b.name}
                    {b.description && (
                      <span className='block text-xs text-slate-400'>{b.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className='space-y-1'>
              <label htmlFor='request-note' className='block text-xs font-medium text-slate-600'>
                Their role, and why they need it
              </label>
              <textarea
                id='request-note'
                required
                minLength={10}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className='min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
                placeholder='Joining as payroll executive; runs the monthly payroll from November.'
              />
            </div>
            {create.error && (
              <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>
            )}
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={picked.length === 0 || note.trim().length < 10 || create.isPending}
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
              >
                Send request
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default RequestAccessModal;

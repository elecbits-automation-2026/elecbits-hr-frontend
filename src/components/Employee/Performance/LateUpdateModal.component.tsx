import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Goal } from '@app-types/api.types';
import { performanceApi } from '@services/api/performance.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * Fill in a MISSED day's update after the fact. It goes to your manager for
 * approval — approved, it clears the miss; declined, the miss stands.
 */
const LateUpdateModal = ({
  date,
  goals,
  selfGoverned,
  onClose,
}: {
  date: string;
  goals: Goal[];
  selfGoverned: boolean;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const submit = useMutation({
    mutationFn: () =>
      performanceApi.submitUpdate({
        note: note.trim(),
        date,
        ...(tags.length ? { goalIds: tags } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work-updates'] });
      onClose();
    },
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>Missed update · {date}</h2>
        <p className='mt-1 text-xs text-slate-400'>
          {selfGoverned
            ? 'Saved as written — it clears the miss.'
            : 'Goes to your manager. Approved, it clears the miss; declined, the day stays missed.'}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder='What did you actually work on that day?'
          className='mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
        />
        {goals.length > 0 && (
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {goals.map((g) => (
              <button
                key={g.id}
                type='button'
                onClick={() =>
                  setTags((t) => (t.includes(g.id) ? t.filter((x) => x !== g.id) : [...t, g.id]))
                }
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  tags.includes(g.id)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}
        {submit.error && (
          <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(submit.error)}</p>
        )}
        <div className='mt-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={submit.isPending || note.trim().length < 10}
            onClick={() => submit.mutate()}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
          >
            {submit.isPending ? 'Saving…' : selfGoverned ? 'Save' : 'Send for approval'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LateUpdateModal;

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CareerTrackNote } from '@app-types/api.types';
import { careerApi } from '@services/api/career.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * The open roadmap's notes. The RM or HR passes `trackId` to get the composer;
 * the employee reads only (the server refuses their writes either way).
 */
const RoadmapNotes = ({
  notes,
  trackId,
  employeeId,
}: {
  notes: CareerTrackNote[];
  /** Present = the viewer may write (RM-or-HR on someone else's roadmap). */
  trackId?: string;
  employeeId?: string;
}) => {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: () => careerApi.addNote(trackId!, body.trim()),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['person-career', employeeId] });
    },
  });

  return (
    <div className='space-y-2'>
      {notes.length === 0 ? (
        <p className='text-sm text-slate-400'>
          {trackId ? 'No notes yet — what should they work on?' : 'No notes from your manager yet.'}
        </p>
      ) : (
        <ul className='space-y-2'>
          {notes.map((n) => (
            <li key={n.id} className='rounded-lg border border-slate-100 bg-slate-50 p-3'>
              <p className='whitespace-pre-wrap text-sm text-slate-700'>{n.body}</p>
              <p className='mt-1 text-xs text-slate-400'>
                {n.authorName ?? 'Someone'} · {n.createdAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {trackId && (
        <div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder='Add a note they will see on their growth page…'
            className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
          {add.error && <p className='text-xs text-red-600'>{apiErrorMessage(add.error)}</p>}
          <div className='flex justify-end'>
            <button
              type='button'
              disabled={add.isPending || body.trim().length < 2}
              onClick={() => add.mutate()}
              className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40'
            >
              {add.isPending ? 'Adding…' : 'Add note'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoadmapNotes;

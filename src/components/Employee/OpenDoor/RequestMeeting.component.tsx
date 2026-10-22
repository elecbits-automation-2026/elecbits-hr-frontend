import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { openDoorApi } from '@services/api/openDoor.api';
import { apiErrorMessage } from '@utils/apiError';

const DAY_MS = 86_400_000;
const today = () => new Date().toLocaleDateString('en-CA');
const plusDays = (n: number) => new Date(Date.now() + n * DAY_MS).toLocaleDateString('en-CA');

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

/**
 * "Request a meeting about this case" — for the raiser of a NAMED concern
 * (an anonymous one never gets a meeting; it would name the raiser). Whoever
 * handles the case now offers a time or declines; it shows on the Requests
 * tab and as a line on the case.
 */
const RequestMeeting = ({ concernId, onSent }: { concernId: string; onSent: () => void }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(plusDays(7));
  const [topic, setTopic] = useState('');
  const send = useMutation({
    mutationFn: () =>
      openDoorApi.createRequest({
        concernId,
        preferredFrom: from,
        preferredTo: to,
        ...(topic.trim() ? { topic: topic.trim() } : {}),
      }),
    onSuccess: () => {
      setOpen(false);
      setTopic('');
      queryClient.invalidateQueries({ queryKey: ['open-door-requests'] });
      onSent();
    },
  });

  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
      >
        Request a meeting about this case
      </button>
    );
  }
  return (
    <div className='space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3'>
      <p className='text-xs text-slate-500'>
        Whoever handles your case will offer a time or reply. You&rsquo;ll see it under Grievances →
        Requests.
      </p>
      <div className='grid gap-2 sm:grid-cols-2'>
        <label className='text-xs text-slate-500'>
          Any time from
          <input
            type='date'
            min={today()}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className='text-xs text-slate-500'>
          until
          <input
            type='date'
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder='Anything they should know first (optional)'
        className={inputClass}
      />
      {send.error && <p className='text-sm text-red-600'>{apiErrorMessage(send.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button
          type='button'
          onClick={() => setOpen(false)}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
        >
          Back
        </button>
        <button
          type='button'
          disabled={send.isPending || to < from}
          onClick={() => send.mutate()}
          className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
        >
          {send.isPending ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
  );
};

export default RequestMeeting;

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { FeedbackType } from '@app-types/api.types';
import { feedbackApi } from '@services/api/feedback.api';
import { apiErrorMessage } from '@utils/apiError';

export interface FeedbackDraft {
  recipient: { id: string; name: string };
  type: FeedbackType;
  body: string;
  evidence?: string;
}

/**
 * The human half of the feedback loop (user decision): the system DRAFTS the
 * note from an insight's evidence; this modal lets the manager edit, switch
 * the tone, and consciously send. Nothing goes out without this click.
 */
const FeedbackModal = ({ draft, onClose }: { draft: FeedbackDraft; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [type, setType] = useState<FeedbackType>(draft.type);
  const [body, setBody] = useState(draft.body);

  const send = useMutation({
    mutationFn: () =>
      feedbackApi.send({
        employeeId: draft.recipient.id,
        type,
        body: body.trim(),
        ...(draft.evidence ? { evidence: draft.evidence } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-sent'] });
      onClose();
    },
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-lg rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>
          Note to {draft.recipient.name}
        </h2>
        {draft.evidence && (
          <p className='mt-1 text-xs text-slate-400'>Based on: {draft.evidence}</p>
        )}

        <div className='mt-4 flex gap-2'>
          {(['appreciation', 'concern'] as const).map((t) => (
            <button
              key={t}
              type='button'
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                type === t
                  ? t === 'appreciation'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className='mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
        />

        {send.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(send.error)}</p>}

        <div className='mt-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Discard
          </button>
          <button
            type='button'
            disabled={send.isPending || body.trim().length < 3}
            onClick={() => send.mutate()}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {send.isPending ? 'Sending…' : 'Send note'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;

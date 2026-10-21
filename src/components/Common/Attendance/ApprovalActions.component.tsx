import { useState } from 'react';

/**
 * Approve / Decline pair with an inline optional decline reason — the same
 * interaction as the leave queue, extracted for the attendance queues.
 */
const ApprovalActions = ({
  onApprove,
  onDecline,
  disabled,
}: {
  onApprove: () => void;
  onDecline: (reason?: string) => void;
  disabled: boolean;
}) => {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  if (declining) {
    return (
      <div className='flex items-center gap-2'>
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='Reason (required)'
          className='w-40 rounded-md border border-slate-300 px-2 py-1 text-xs'
        />
        <button
          type='button'
          disabled={disabled || !reason.trim()}
          onClick={() => {
            onDecline(reason.trim());
            setDeclining(false);
            setReason('');
          }}
          className='rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50'
        >
          Decline
        </button>
        <button type='button' onClick={() => setDeclining(false)} className='text-xs text-slate-400 hover:text-slate-600'>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className='flex gap-2'>
      <button
        type='button'
        disabled={disabled}
        onClick={onApprove}
        className='rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50'
      >
        Approve
      </button>
      <button
        type='button'
        disabled={disabled}
        onClick={() => setDeclining(true)}
        className='rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
      >
        Decline
      </button>
    </div>
  );
};

export default ApprovalActions;

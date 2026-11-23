import { Link } from 'react-router-dom';

import { apiErrorMessage, isForbidden } from '@utils/apiError';

/**
 * What a screen shows when its data could not load. A 403 gets a calm
 * "no access" panel (with the server's reason) instead of a red error, so a
 * shared link to an HR-only page explains itself; anything else stays a red
 * line with the server's message.
 */
const QueryError = ({ error, compact = false }: { error: unknown; compact?: boolean }) => {
  if (isForbidden(error)) {
    return (
      <div
        role='status'
        className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-6'} text-sm text-slate-700`}
      >
        <p className='font-medium text-slate-800'>You don&apos;t have access to this</p>
        <p className='mt-1 text-slate-600'>{apiErrorMessage(error)}</p>
        {!compact && (
          <p className='mt-3 text-slate-600'>
            If you need it for your work, ask HR or your manager.{' '}
            <Link to='/' className='font-medium text-brand-600 underline'>
              Go to Home
            </Link>
          </p>
        )}
      </div>
    );
  }
  return (
    <p role='alert' className='text-sm text-red-600'>
      {apiErrorMessage(error)}
    </p>
  );
};

export default QueryError;

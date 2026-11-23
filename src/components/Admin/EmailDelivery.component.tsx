import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { emailApi } from '@services/api/email.api';
import { apiErrorMessage } from '@utils/apiError';

/** One count in the stats row. */
const Stat = ({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) => (
  <div className='rounded-lg bg-slate-50 px-3 py-2'>
    <div
      className={`text-lg font-semibold tabular-nums ${warn ? 'text-red-600' : 'text-slate-800'}`}
    >
      {value}
    </div>
    <div className='text-xs text-slate-500'>{label}</div>
  </div>
);

/**
 * Email delivery (Admin): is the switch on, which sender is wired (`log`
 * writes to the server log only; `gmail` really sends), the test redirect,
 * the queue counts, recent failures with Retry, and a test email to yourself.
 * The test goes out even with the switch off — it is how the sender is
 * checked before HR emails are turned on in Settings → Email delivery.
 */
const EmailDelivery = () => {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['admin-email'], queryFn: emailApi.status });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-email'] });
  const retry = useMutation({ mutationFn: emailApi.retryFailed, onSettled: refresh });
  const test = useMutation({ mutationFn: emailApi.sendTest });
  const s = status.data;

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='text-sm font-semibold text-slate-700'>Email delivery</h2>
        {s && (
          <div className='flex flex-wrap gap-2'>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                s.enabled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              HR emails {s.enabled ? 'on' : 'off'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                s.driver === 'gmail' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {s.driver === 'gmail' ? 'sending via Gmail' : 'log only — nothing really sent'}
            </span>
          </div>
        )}
      </div>
      {status.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(status.error)}</p>}

      {s && (
        <>
          <p className='mt-2 text-xs text-slate-500'>
            From <b className='text-slate-700'>{s.from}</b>
            {s.replyTo && (
              <>
                {' '}
                · replies to <b className='text-slate-700'>{s.replyTo}</b>
              </>
            )}
            {!s.enabled &&
              ' · switch on under Access → Email delivery once the test email below arrives.'}
          </p>
          {s.redirectTo && (
            <p className='mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800'>
              Testing redirect is on: every email goes to <b>{s.redirectTo}</b> instead of the real
              person (named in the subject).
            </p>
          )}

          <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            <Stat label='Waiting to send' value={s.pending} />
            <Stat label='Failed' value={s.failed} warn={s.failed > 0} />
            <Stat label='Sent, last 24 h' value={s.sentLastDay} />
            <Stat label='Sent, last 30 days' value={s.sentLast30Days} />
          </div>

          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <button
              type='button'
              disabled={test.isPending}
              onClick={() => test.mutate()}
              className='rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'
            >
              {test.isPending ? 'Sending…' : 'Send test email to me'}
            </button>
            {s.failed > 0 && (
              <button
                type='button'
                disabled={retry.isPending}
                onClick={() => retry.mutate()}
                className='rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'
              >
                {retry.isPending ? 'Retrying…' : `Retry ${s.failed} failed`}
              </button>
            )}
            {test.data && (
              <span className='text-xs text-green-700'>
                {test.data.driver === 'gmail'
                  ? `Sent to ${test.data.sentTo} — check that inbox.`
                  : `Written to the server log for ${test.data.sentTo} (log sender — nothing really sent).`}
              </span>
            )}
            {retry.data && (
              <span className='text-xs text-slate-500'>{retry.data.requeued} queued again.</span>
            )}
          </div>
          {test.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(test.error)}</p>}
          {retry.error && (
            <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(retry.error)}</p>
          )}

          {s.recentFailures.length > 0 && (
            <div className='overflow-x-auto'>
              <table className='mt-4 w-full text-left text-xs'>
                <thead>
                  <tr className='text-slate-500'>
                    <th className='py-1 pr-3 font-medium'>Queued</th>
                    <th className='py-1 pr-3 font-medium'>To</th>
                    <th className='py-1 pr-3 font-medium'>Subject</th>
                    <th className='py-1 pr-3 font-medium'>Tries</th>
                    <th className='py-1 font-medium'>Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentFailures.map((f) => (
                    <tr key={f.id} className='border-t border-slate-100 align-top'>
                      <td className='py-1.5 pr-3 tabular-nums text-slate-500'>
                        {new Date(f.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className='py-1.5 pr-3 text-slate-700'>{f.toAddress}</td>
                      <td className='py-1.5 pr-3 text-slate-700'>{f.subject}</td>
                      <td className='py-1.5 pr-3 tabular-nums text-slate-500'>{f.attempts}</td>
                      <td className='py-1.5 text-red-600'>{f.lastError ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EmailDelivery;

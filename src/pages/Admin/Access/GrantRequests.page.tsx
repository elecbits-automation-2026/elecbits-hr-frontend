import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GrantRequest, GrantRequestItem } from '@app-types/api.types';
import { accessApi } from '@services/api/access.api';
import { apiErrorMessage } from '@utils/apiError';

const itemLabel = (i: GrantRequestItem): string =>
  i.kind === 'batch'
    ? `${i.batchName ?? 'Batch'} batch`
    : `${i.moduleKey} · ${i.action} · ${i.scope}`;
const itemKey = (i: GrantRequestItem): string =>
  i.kind === 'batch' ? `b:${i.batchId}` : `g:${i.moduleKey}:${i.action}:${i.scope}`;

const STATUS: Record<GrantRequest['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-green-50 text-green-700' },
  approved_narrower: { label: 'Approved in part', cls: 'bg-green-50 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

/**
 * One pending request: every asked item starts ticked; untick to approve
 * narrower. Declining needs a reason the requester will see.
 */
const PendingCard = ({ request }: { request: GrantRequest }) => {
  const queryClient = useQueryClient();
  const [kept, setKept] = useState(() => new Set(request.requested.map(itemKey)));
  const [reason, setReason] = useState('');

  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'decline') =>
      accessApi.decideGrantRequest(request.id, {
        decision,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(decision === 'approve'
          ? {
              grantedItems: request.requested
                .filter((i) => kept.has(itemKey(i)))
                .map(({ kind, batchId, moduleKey, action, scope }) => ({
                  kind,
                  batchId,
                  moduleKey,
                  action,
                  scope,
                })),
            }
          : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grant-requests'] }),
  });

  const toggle = (k: string) => {
    const next = new Set(kept);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setKept(next);
  };
  const narrower = kept.size < request.requested.length;

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <div className='font-medium text-slate-800'>
          Access for {request.employee.name}
          <span className='ml-2 text-sm font-normal text-slate-400'>
            asked by {request.requestedBy.name} · {new Date(request.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      {request.note && <p className='mt-2 text-sm text-slate-600'>{request.note}</p>}

      <div className='mt-3 space-y-1.5'>
        {request.requested.map((i) => (
          <label key={itemKey(i)} className='flex items-center gap-2 text-sm text-slate-700'>
            <input
              type='checkbox'
              checked={kept.has(itemKey(i))}
              onChange={() => toggle(itemKey(i))}
              className='h-4 w-4'
            />
            {itemLabel(i)}
          </label>
        ))}
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder='Reason (required to decline; shown to the requester)'
        maxLength={500}
        className='mt-3 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
      />
      {decide.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(decide.error)}</p>}

      <div className='mt-3 flex flex-wrap justify-end gap-2'>
        <button
          type='button'
          disabled={decide.isPending || reason.trim().length < 3}
          onClick={() => decide.mutate('decline')}
          title={reason.trim().length < 3 ? 'Write a reason to decline' : undefined}
          className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40'
        >
          Decline
        </button>
        <button
          type='button'
          disabled={decide.isPending || kept.size === 0}
          onClick={() => decide.mutate('approve')}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
        >
          {narrower ? `Approve ${kept.size} of ${request.requested.length}` : 'Approve as asked'}
        </button>
      </div>
    </div>
  );
};

/**
 * Grant requests (Admin): HR asks for extra access for one person; you
 * approve as asked, approve part of it, or decline with a reason. Approved
 * access applies on the person's next request. Nobody decides a request
 * that involves them.
 */
const GrantRequestsPage = () => {
  const requests = useQuery({ queryKey: ['grant-requests'], queryFn: accessApi.listGrantRequests });
  const pending = (requests.data ?? []).filter((r) => r.status === 'pending');
  const decided = (requests.data ?? []).filter((r) => r.status !== 'pending');

  return (
    <div className='w-full max-w-3xl space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Grant requests</h1>
      <p className='text-sm text-slate-500'>
        HR asks for extra access for one person at a time. Approve as asked, untick items to approve
        part of it, or decline with a reason. Approved access applies immediately.
      </p>

      {requests.error && <p className='text-sm text-red-600'>{apiErrorMessage(requests.error)}</p>}
      {requests.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}

      {requests.data && pending.length === 0 && (
        <p className='rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500'>
          No pending requests.
        </p>
      )}
      {pending.map((r) => (
        <PendingCard key={r.id} request={r} />
      ))}

      {decided.length > 0 && (
        <section className='space-y-2'>
          <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Decided</h2>
          <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white'>
            <table className='w-full text-left text-sm'>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id} className='border-t border-slate-100 first:border-t-0'>
                    <td className='px-4 py-3'>
                      <span className='font-medium text-slate-800'>{r.employee.name}</span>
                      <span className='block text-xs text-slate-400'>
                        asked by {r.requestedBy.name}
                        {r.decidedBy ? ` · decided by ${r.decidedBy.name}` : ''}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-xs text-slate-500'>
                      {(r.granted.length > 0 ? r.granted : r.requested).map(itemLabel).join(', ')}
                      {r.decisionReason && (
                        <span className='block text-slate-400'>“{r.decisionReason}”</span>
                      )}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status].cls}`}>
                        {STATUS[r.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default GrantRequestsPage;

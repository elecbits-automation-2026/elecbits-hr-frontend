import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MyPolicy, PolicyCategory } from '@app-types/api.types';
import { policiesApi } from '@services/api/policies.api';
import { apiErrorMessage } from '@utils/apiError';

const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  conduct: 'Conduct',
  handbook: 'Handbook',
  performance: 'Performance',
  time: 'Time',
  culture: 'Culture',
  other: 'Other',
};
const CATEGORY_ORDER: PolicyCategory[] = [
  'conduct',
  'handbook',
  'performance',
  'time',
  'culture',
  'other',
];

const stateChip = (p: MyPolicy) => {
  if (!p.ackRequired)
    return <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'>no sign-off needed</span>;
  switch (p.ack.state) {
    case 'ok':
      return (
        <span className='rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700'>
          acknowledged v{p.ack.ackedVersion}
        </span>
      );
    case 'stale':
      return (
        <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'>
          updated — re-acknowledgement needed
        </span>
      );
    default:
      return <span className='rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700'>not acknowledged</span>;
  }
};

/**
 * Confirm-with-a-checkbox modal: only name, version and time are recorded.
 * OPEN BEFORE ACKNOWLEDGE (refinement plan, client-side v1): when there is a
 * document, the checkbox stays locked until it has been opened from here; a
 * policy with no document can still be signed, with a warning.
 */
const AckModal = ({ policy, onClose }: { policy: MyPolicy; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [read, setRead] = useState(false);
  const hasDoc = policy.hasDocument || Boolean(policy.docUrl);
  const [opened, setOpened] = useState(false);
  const mustOpen = hasDoc && !opened;

  const ack = useMutation({
    mutationFn: () => policiesApi.acknowledge(policy.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-policies'] });
      queryClient.invalidateQueries({ queryKey: ['hr-policy-tracker'] });
      onClose();
    },
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-lg rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>
          {policy.title} <span className='text-sm font-normal text-slate-400'>v{policy.version}</span>
        </h2>
        {policy.ack.state === 'stale' && (
          <p className='mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-700'>
            You acknowledged v{policy.ack.ackedVersion}; the policy is now v{policy.version}. Your
            earlier signature stays on record — this signs the new version.
          </p>
        )}
        {policy.summary && <p className='mt-3 text-sm text-slate-600'>{policy.summary}</p>}
        {policy.hasDocument ? (
          <button
            type='button'
            onClick={() => {
              setOpened(true);
              void policiesApi.openDocument(policy.id);
            }}
            className='mt-3 inline-block text-sm text-brand-600 hover:underline'
          >
            Open the document →
          </button>
        ) : policy.docUrl ? (
          <a
            href={policy.docUrl}
            target='_blank'
            rel='noreferrer'
            onClick={() => setOpened(true)}
            className='mt-3 inline-block text-sm text-brand-600 hover:underline'
          >
            Open the document →
          </a>
        ) : (
          <p className='mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-700'>
            HR hasn&rsquo;t attached the document yet. You can still acknowledge the summary above,
            or ask HR for the document first.
          </p>
        )}

        <label
          className={`mt-4 flex items-start gap-2 text-sm ${mustOpen ? 'text-slate-400' : 'text-slate-700'}`}
        >
          <input
            type='checkbox'
            checked={read}
            disabled={mustOpen}
            onChange={(e) => setRead(e.target.checked)}
            className='mt-0.5'
          />
          I have read and understood this policy.
        </label>
        {mustOpen && (
          <p className='mt-1 text-xs text-slate-500'>Open the document first to acknowledge it.</p>
        )}
        <p className='mt-1 text-xs text-slate-400'>
          Only your name, the version and the time are recorded.
        </p>

        {ack.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(ack.error)}</p>}

        <div className='mt-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Not now
          </button>
          <button
            type='button'
            disabled={!read || mustOpen || ack.isPending}
            onClick={() => ack.mutate()}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {ack.isPending ? 'Signing…' : 'Acknowledge'}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Own policy library: what applies, what's signed, what's waiting. */
const MyPoliciesPage = () => {
  const [signing, setSigning] = useState<MyPolicy | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-policies'],
    queryFn: policiesApi.mine,
  });

  if (isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (error) return <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>;

  const all = data ?? [];
  const waiting = all.filter((p) => p.ackRequired && p.ack.state !== 'ok');

  return (
    <div className='w-full space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Policies</h1>

      {waiting.length > 0 ? (
        <div className='rounded-xl border border-amber-200 bg-amber-50 p-4'>
          <p className='text-sm font-medium text-amber-800'>
            {waiting.length} {waiting.length === 1 ? 'policy is' : 'policies are'} waiting on you:{' '}
            {waiting.map((p) => p.title).join(', ')}
          </p>
          <button
            type='button'
            onClick={() => setSigning(waiting[0]!)}
            className='mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500'
          >
            Start with “{waiting[0]!.title}”
          </button>
        </div>
      ) : (
        all.length > 0 && (
          <p className='text-sm text-green-700'>You are up to date on every policy that needs a sign-off.</p>
        )
      )}

      {all.length === 0 && (
        <p className='text-sm text-slate-500'>No policies have been published yet.</p>
      )}

      {CATEGORY_ORDER.filter((c) => all.some((p) => p.category === c)).map((cat) => (
        <div key={cat} className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-slate-400'>
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className='mt-3 divide-y divide-slate-100'>
            {all
              .filter((p) => p.category === cat)
              .map((p) => (
                <div key={p.id} className='flex flex-wrap items-center justify-between gap-2 py-3'>
                  <div className='min-w-0'>
                    <p className='font-medium text-slate-800'>
                      {p.title} <span className='text-xs text-slate-400'>v{p.version}</span>
                    </p>
                    {p.summary && <p className='mt-0.5 text-xs text-slate-500'>{p.summary}</p>}
                    {p.hasDocument ? (
                      <button
                        type='button'
                        onClick={() => void policiesApi.openDocument(p.id)}
                        className='mt-0.5 inline-block text-xs text-brand-600 hover:underline'
                      >
                        Open the document →
                      </button>
                    ) : p.docUrl ? (
                      <a
                        href={p.docUrl}
                        target='_blank'
                        rel='noreferrer'
                        className='mt-0.5 inline-block text-xs text-brand-600 hover:underline'
                      >
                        Open the document →
                      </a>
                    ) : (
                      <p className='mt-0.5 text-xs text-slate-400'>Not linked yet — ask HR.</p>
                    )}
                  </div>
                  <div className='flex shrink-0 items-center gap-2'>
                    {stateChip(p)}
                    {p.ackRequired && p.ack.state !== 'ok' && (
                      <button
                        type='button'
                        onClick={() => setSigning(p)}
                        className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500'
                      >
                        Read & acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {signing && <AckModal policy={signing} onClose={() => setSigning(null)} />}
    </div>
  );
};

export default MyPoliciesPage;

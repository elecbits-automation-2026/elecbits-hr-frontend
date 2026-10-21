import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Asset, AssetCondition, AssetRequest } from '@app-types/api.types';
import {
  CONDITION_LABELS,
  REQUEST_STATUS_CLASS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  chipClass,
  fmtWhen,
  inputClass,
  opsToday,
  primaryBtn,
  secondaryBtn,
} from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';

const ISSUES = new Set(['new', 'upgrade', 'replacement']);
const TAKES_BACK = new Set(['upgrade', 'replacement', 'return']);

/** One request: pick it up, decline it, or fulfil it (issue / take back in one go). */
const RequestCard = ({
  r,
  stock,
  onDone,
}: {
  r: AssetRequest;
  stock: Asset[];
  onDone: () => void;
}) => {
  const [mode, setMode] = useState<null | 'fulfil' | 'decline'>(null);
  const [issueAssetId, setIssueAssetId] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('good');
  const [note, setNote] = useState('');
  const closed = r.status === 'fulfilled' || r.status === 'declined';
  const needsIssue = ISSUES.has(r.type);
  const chosen = stock.find((a) => a.id === issueAssetId);
  // Offer the requested category first, then everything else that's free.
  const choices = [...stock].sort(
    (a, b) => Number(b.category.id === r.category?.id) - Number(a.category.id === r.category?.id),
  );

  const act = useMutation({
    mutationFn: async (what: 'pick' | 'decline' | 'fulfil') => {
      if (what === 'pick') return opsApi.handleRequest(r.id, { status: 'in_progress' });
      if (what === 'decline') return opsApi.handleRequest(r.id, { status: 'declined', note });
      return opsApi.fulfilRequest(r.id, {
        ...(needsIssue ? { issueAssetId } : {}),
        ...(chosen?.category.kind === 'lab' ? { dueOn } : {}),
        ...(TAKES_BACK.has(r.type) ? { returnCondition: condition } : {}),
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      setMode(null);
      onDone();
    },
  });

  return (
    <li className='space-y-2 rounded-lg border border-slate-200 bg-white p-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className={`${chipClass} ${REQUEST_STATUS_CLASS[r.status]}`}>
          {REQUEST_STATUS_LABELS[r.status]}
        </span>
        <span className='font-medium text-slate-800'>{REQUEST_TYPE_LABELS[r.type]}</span>
        <span className='text-sm text-slate-600'>— {r.requestedBy.name}</span>
        <span className='ml-auto text-xs text-slate-400'>{fmtWhen(r.createdAt)}</span>
      </div>
      <p className='text-sm text-slate-600'>
        {r.asset && (
          <>
            About <span className='font-mono text-xs'>{r.asset.assetCode}</span> {r.asset.name}
            .{' '}
          </>
        )}
        {r.category && <>Wants: {r.category.name}. </>}
        {r.note}
      </p>
      {r.handlerNote && (
        <p className='text-xs text-slate-500'>
          {r.handledBy?.name}: {r.handlerNote}
        </p>
      )}
      {r.fulfilledAsset && (
        <p className='text-xs text-green-700'>
          Issued {r.fulfilledAsset.assetCode} {r.fulfilledAsset.name}
        </p>
      )}

      {!closed && !mode && (
        <div className='flex flex-wrap gap-2'>
          {r.status === 'open' && (
            <button
              type='button'
              disabled={act.isPending}
              onClick={() => act.mutate('pick')}
              className={secondaryBtn}
            >
              Pick up
            </button>
          )}
          <button type='button' onClick={() => setMode('fulfil')} className={primaryBtn}>
            {needsIssue ? 'Fulfil — hand over' : r.type === 'return' ? 'Take it back' : 'Mark done'}
          </button>
          <button type='button' onClick={() => setMode('decline')} className={secondaryBtn}>
            Decline
          </button>
        </div>
      )}

      {mode && (
        <div className='space-y-2 rounded-lg bg-slate-50 p-3'>
          {mode === 'fulfil' && needsIssue && (
            <>
              <select
                value={issueAssetId}
                onChange={(e) => setIssueAssetId(e.target.value)}
                className={inputClass}
              >
                <option value=''>Hand over which asset? (idle or shared)</option>
                {choices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetCode} · {a.name} · {a.category.name} · {a.zone.name}
                  </option>
                ))}
              </select>
              {chosen?.category.kind === 'lab' && (
                <label className='block space-y-1'>
                  <span className='text-xs text-slate-500'>Lent until</span>
                  <input
                    type='date'
                    min={opsToday()}
                    value={dueOn}
                    onChange={(e) => setDueOn(e.target.value)}
                    className={inputClass}
                  />
                </label>
              )}
            </>
          )}
          {mode === 'fulfil' && TAKES_BACK.has(r.type) && r.asset && (
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AssetCondition)}
              className={inputClass}
            >
              {Object.entries(CONDITION_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {r.asset!.assetCode} comes back: {l}
                </option>
              ))}
            </select>
          )}
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'decline' ? 'Why (they see this)' : 'Note for them (optional)'}
            className={inputClass}
          />
          {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => setMode(null)} className={secondaryBtn}>
              Back
            </button>
            <button
              type='button'
              disabled={
                act.isPending ||
                (mode === 'decline' && !note.trim()) ||
                (mode === 'fulfil' && needsIssue && !issueAssetId) ||
                (mode === 'fulfil' && chosen?.category.kind === 'lab' && !dueOn)
              }
              onClick={() => act.mutate(mode)}
              className={primaryBtn}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

/**
 * The OPS request queue: new assets, upgrades, replacements, repairs and
 * returns. Fulfilling an upgrade / replacement hands over the new item and
 * takes the old one back in the same step.
 */
const RequestQueuePage = () => {
  const queryClient = useQueryClient();
  const [showClosed, setShowClosed] = useState(false);
  const queue = useQuery({ queryKey: ['ops-requests'], queryFn: opsApi.requestQueue });
  const assets = useQuery({ queryKey: ['ops-assets'], queryFn: () => opsApi.listAssets() });
  const free = (assets.data ?? []).filter(
    (a) => (a.status === 'idle' || a.status === 'in_use_shared') && !a.openPass,
  );
  const rows = (queue.data ?? []).filter(
    (r) => showClosed || r.status === 'open' || r.status === 'in_progress',
  );
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ops-requests'] });
    queryClient.invalidateQueries({ queryKey: ['ops-assets'] });
  };

  return (
    <div className='w-full max-w-4xl space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Asset requests</h1>
          <p className='text-sm text-slate-500'>
            What people have asked OPS for. Anyone holding the OPS batch can pick one up.
          </p>
        </div>
        <label className='flex items-center gap-2 text-sm text-slate-600'>
          <input
            type='checkbox'
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
          />
          Show done and declined
        </label>
      </div>
      {queue.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
      {queue.error && <p className='text-sm text-red-600'>{apiErrorMessage(queue.error)}</p>}
      {queue.data && rows.length === 0 && (
        <p className='rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400'>
          Nothing waiting.
        </p>
      )}
      <ul className='space-y-3'>
        {rows.map((r) => (
          <RequestCard key={r.id} r={r} stock={free} onDone={refresh} />
        ))}
      </ul>
    </div>
  );
};

export default RequestQueuePage;

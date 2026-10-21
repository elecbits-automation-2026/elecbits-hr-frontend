import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GatePass } from '@app-types/api.types';
import {
  PASS_STATUS_CLASS,
  PASS_STATUS_LABELS,
  chipClass,
  fmtDay,
  fmtWhen,
  inputClass,
  primaryBtn,
  secondaryBtn,
} from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';

type Tab = 'requested' | 'out' | 'overdue' | 'closed';

const PassCard = ({ p, onDone }: { p: GatePass; onDone: () => void }) => {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const act = useMutation({
    mutationFn: (what: 'approve' | 'decline' | 'back') =>
      what === 'approve'
        ? opsApi.approvePass(p.id)
        : what === 'decline'
          ? opsApi.declinePass(p.id, reason)
          : opsApi.markPassBack(p.id),
    onSuccess: () => {
      setDeclining(false);
      onDone();
    },
  });
  const extended = p.returnOn !== p.originalReturnOn;

  return (
    <li className='space-y-2 rounded-lg border border-slate-200 bg-white p-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <span
          className={`${chipClass} ${p.overdue ? 'bg-red-50 text-red-700' : PASS_STATUS_CLASS[p.status]}`}
        >
          {p.overdue ? 'Overdue' : PASS_STATUS_LABELS[p.status]}
        </span>
        <span className='font-mono text-xs text-slate-400'>{p.asset.assetCode}</span>
        <span className='font-medium text-slate-800'>{p.asset.name}</span>
        <span className='ml-auto text-xs text-slate-400'>{fmtWhen(p.createdAt)}</span>
      </div>
      <p className='text-sm text-slate-600'>
        <b>{p.holder.name}</b> → {p.destination} · {p.purpose}
      </p>
      <p className='text-xs text-slate-500'>
        From {p.asset.zone.name} · back by {fmtDay(p.returnOn)}
        {extended ? ` (first asked for ${fmtDay(p.originalReturnOn)})` : ''} · responsibility
        accepted {fmtWhen(p.disclaimerAcceptedAt)}
      </p>
      {p.declineReason && <p className='text-xs text-slate-500'>Declined: {p.declineReason}</p>}
      {p.returnedAt && (
        <p className='text-xs text-green-700'>
          Back {fmtWhen(p.returnedAt)} — confirmed by {p.returnedConfirmedBy?.name}
        </p>
      )}

      {p.status === 'requested' && !declining && (
        <div className='flex gap-2'>
          <button
            type='button'
            disabled={act.isPending}
            onClick={() => act.mutate('approve')}
            className={primaryBtn}
          >
            Approve — it may leave
          </button>
          <button type='button' onClick={() => setDeclining(true)} className={secondaryBtn}>
            Decline
          </button>
        </div>
      )}
      {declining && (
        <div className='space-y-2'>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Why (they see this)'
            className={inputClass}
          />
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => setDeclining(false)} className={secondaryBtn}>
              Back
            </button>
            <button
              type='button'
              disabled={reason.trim().length < 2 || act.isPending}
              onClick={() => act.mutate('decline')}
              className={primaryBtn}
            >
              Decline
            </button>
          </div>
        </div>
      )}
      {p.status === 'approved' && (
        <button
          type='button'
          disabled={act.isPending}
          onClick={() => act.mutate('back')}
          className={secondaryBtn}
        >
          Mark back at {p.asset.zone.name}
        </button>
      )}
      {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}
    </li>
  );
};

/**
 * Gate passes for flagged categories (lab equipment, samples). Approval lets
 * the item leave; the requester is answerable for it until it is back. After
 * the return date the holder is asked "back or still out?" every 2 working
 * days, and after 5 OPS and their RM are told.
 */
const GatePassesPage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('requested');
  const passes = useQuery({ queryKey: ['ops-passes'], queryFn: opsApi.gatePasses });
  const all = passes.data ?? [];
  const groups: Record<Tab, GatePass[]> = {
    requested: all.filter((p) => p.status === 'requested'),
    out: all.filter((p) => p.status === 'approved' && !p.overdue),
    overdue: all.filter((p) => p.overdue),
    closed: all.filter((p) => p.status === 'declined' || p.status === 'returned'),
  };
  const labels: Record<Tab, string> = {
    requested: 'Waiting for you',
    out: 'Out',
    overdue: 'Overdue',
    closed: 'Closed',
  };
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ops-passes'] });
    queryClient.invalidateQueries({ queryKey: ['ops-assets'] });
  };

  return (
    <div className='w-full max-w-4xl space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Gate passes</h1>
        <p className='text-sm text-slate-500'>
          Items leaving their zone. Only categories flagged in OPS setup can go out on a pass.
        </p>
      </div>
      <div className='flex flex-wrap gap-1 border-b border-slate-200'>
        {(Object.keys(labels) as Tab[]).map((t) => (
          <button
            key={t}
            type='button'
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {labels[t]}
            {t !== 'closed' && groups[t].length > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 text-xs ${t === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}
              >
                {groups[t].length}
              </span>
            )}
          </button>
        ))}
      </div>
      {passes.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
      {passes.error && <p className='text-sm text-red-600'>{apiErrorMessage(passes.error)}</p>}
      {passes.data && groups[tab].length === 0 && (
        <p className='rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400'>
          Nothing here.
        </p>
      )}
      <ul className='space-y-3'>
        {groups[tab].map((p) => (
          <PassCard key={p.id} p={p} onDone={refresh} />
        ))}
      </ul>
    </div>
  );
};

export default GatePassesPage;

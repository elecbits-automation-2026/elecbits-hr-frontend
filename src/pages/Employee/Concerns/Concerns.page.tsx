import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Concern, ConcernQueueName } from '@app-types/api.types';
import ConcernCase, { StatusChip } from '@components/Employee/Concerns/ConcernCase.component';
import RaiseConcern from '@components/Employee/Concerns/RaiseConcern.component';
import { TRACK_LABELS, categoryLabel, dueLine } from '@constants/Common/concerns.constants';
import { CONCERNS_FOLLOW_UP_ROUTE } from '@constants/Common/navigation/routes.constants';
import { concernsApi } from '@services/api/concerns.api';
import { apiErrorMessage } from '@utils/apiError';

type Tab = 'raise' | 'mine' | ConcernQueueName;

const CaseList = ({
  rows,
  loading,
  error,
  empty,
  showRaiser,
  onOpen,
}: {
  rows: Concern[] | undefined;
  loading: boolean;
  error: unknown;
  empty: string;
  showRaiser?: boolean;
  onOpen: (id: string) => void;
}) => (
  <div className='rounded-xl border border-slate-200 bg-white p-5'>
    {loading && <p className='text-sm text-slate-400'>Loading…</p>}
    {!!error && <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>}
    {rows?.length === 0 && <p className='text-sm text-slate-400'>{empty}</p>}
    <ul className='divide-y divide-slate-100'>
      {(rows ?? []).map((c) => (
        <li key={c.id}>
          <button
            type='button'
            onClick={() => onOpen(c.id)}
            className='flex w-full flex-wrap items-center gap-2 py-3 text-left hover:bg-slate-50'
          >
            <span className='font-mono text-xs text-slate-400'>{c.code}</span>
            <span className='flex-1 truncate text-sm font-medium text-slate-800'>{c.title}</span>
            <StatusChip c={c} />
            <span className='w-full text-xs text-slate-400'>
              {TRACK_LABELS[c.track]} · {categoryLabel(c.track, c.category)}
              {showRaiser ? ` · ${c.anonymous ? 'anonymous' : (c.raisedBy?.name ?? '')}` : ''}
              {dueLine(c) ? ` · ${dueLine(c)}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Concerns: raise one (dispute / complaint / whistleblower; sexual harassment
 * points to the Internal Committee), follow your own, and — for the people
 * who handle them — one tab per queue the backend says you hold. `embedded`
 * drops the page title when it sits inside the Grievances page.
 */
const ConcernsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('mine');
  const [openId, setOpenId] = useState<string | null>(null);

  const mine = useQuery({ queryKey: ['concerns-mine'], queryFn: concernsApi.mine });
  const queues = useQuery({ queryKey: ['concerns-queues'], queryFn: concernsApi.queues });
  const isQueue = tab !== 'raise' && tab !== 'mine';
  const queue = useQuery({
    queryKey: ['concerns-queue', tab],
    queryFn: () => concernsApi.queue(tab as ConcernQueueName),
    enabled: isQueue,
  });
  const open = useQuery({
    queryKey: ['concern', openId],
    queryFn: () => concernsApi.get(openId!),
    enabled: openId !== null,
  });

  const refresh = (c: Concern) => {
    queryClient.setQueryData(['concern', c.id], c);
    queryClient.invalidateQueries({ queryKey: ['concerns-mine'] });
    queryClient.invalidateQueries({ queryKey: ['concerns-queues'] });
    queryClient.invalidateQueries({ queryKey: ['concerns-queue'] });
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'mine', label: 'My concerns' },
    { key: 'raise', label: 'Raise a concern' },
    ...(queues.data ?? []).map((q) => ({ key: q.queue, label: q.label, badge: q.open })),
  ];

  return (
    <div className='w-full max-w-4xl space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          {!embedded && <h1 className='text-2xl font-semibold text-slate-800'>Concerns</h1>}
          <p className='text-sm text-slate-500'>
            Contest a decision, report conduct or misconduct. Handled in confidence; retaliation
            against anyone who raises a concern in good faith is itself a breach.
          </p>
        </div>
        <Link to={CONCERNS_FOLLOW_UP_ROUTE} className='text-sm text-brand-700 hover:underline'>
          Follow up an anonymous report →
        </Link>
      </div>

      <div className='flex flex-wrap gap-1 border-b border-slate-200'>
        {tabs.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className='ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800'>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'raise' && (
        <RaiseConcern
          onFiled={(id) => {
            setTab('mine');
            if (id) setOpenId(id);
          }}
        />
      )}
      {tab === 'mine' && (
        <CaseList
          rows={mine.data}
          loading={mine.isLoading}
          error={mine.error}
          empty='You have not raised anything. Anonymous reports are not listed here — follow them up with their code and key.'
          onOpen={setOpenId}
        />
      )}
      {isQueue && (
        <CaseList
          rows={queue.data}
          loading={queue.isLoading}
          error={queue.error}
          empty='Nothing waiting in this queue.'
          showRaiser
          onOpen={setOpenId}
        />
      )}

      {openId && (
        <div className='fixed inset-0 z-50 flex justify-end bg-slate-900/30'>
          <button
            type='button'
            aria-label='Close'
            className='flex-1 cursor-default'
            onClick={() => setOpenId(null)}
          />
          <div className='h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl'>
            <div className='mb-4 flex justify-end'>
              <button
                type='button'
                onClick={() => setOpenId(null)}
                className='text-sm text-slate-500 hover:text-slate-800'
              >
                Close ✕
              </button>
            </div>
            {open.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
            {open.error && <p className='text-sm text-red-600'>{apiErrorMessage(open.error)}</p>}
            {open.data && (
              <ConcernCase
                key={open.data.id}
                concern={open.data}
                mode={isQueue ? 'handler' : 'raiser'}
                onChanged={refresh}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcernsPage;

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OpenDoorRequest, OpenDoorRequestStatus } from '@app-types/api.types';
import { openDoorApi } from '@services/api/openDoor.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const DAY_MS = 86_400_000;
const today = () => new Date().toLocaleDateString('en-CA');
const plusDays = (n: number) => new Date(Date.now() + n * DAY_MS).toLocaleDateString('en-CA');

const STATUS_LOOK: Record<OpenDoorRequestStatus, { label: string; cls: string }> = {
  requested: { label: 'waiting', cls: 'bg-amber-50 text-amber-700' },
  offered: { label: 'time set', cls: 'bg-green-50 text-green-700' },
  declined: { label: 'declined', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'withdrawn', cls: 'bg-slate-100 text-slate-500' },
};

const Chip = ({ status }: { status: OpenDoorRequestStatus }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_LOOK[status].cls}`}>
    {STATUS_LOOK[status].label}
  </span>
);

/** "Concern DSP-2026-004" or the host's name — who the request went to. */
const target = (r: OpenDoorRequest) =>
  r.concern ? `whoever handles ${r.concern.code}` : (r.host?.name ?? '');

const when = (r: OpenDoorRequest) =>
  r.slot ? `${r.slot.date} · ${r.slot.startTime}–${r.slot.endTime} with ${r.slot.owner.name}` : '';

/** The host's answer: offer a time, or decline with a reason. */
const AnswerRow = ({ r, onDone }: { r: OpenDoorRequest; onDone: () => void }) => {
  const [mode, setMode] = useState<'idle' | 'offer' | 'decline'>('idle');
  const [date, setDate] = useState(r.preferredFrom < today() ? today() : r.preferredFrom);
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('11:30');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const offer = useMutation({
    mutationFn: () =>
      openDoorApi.offerRequest(r.id, {
        date,
        startTime,
        endTime,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: onDone,
  });
  const decline = useMutation({
    mutationFn: () => openDoorApi.declineRequest(r.id, reason.trim()),
    onSuccess: onDone,
  });
  const err = offer.error ?? decline.error;

  return (
    <li className='rounded-lg border border-slate-200 bg-white p-3'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <span className='text-sm font-medium text-slate-800'>
          {r.employee.name}
          {r.concern && (
            <span className='ml-2 font-mono text-xs text-slate-400'>{r.concern.code}</span>
          )}
        </span>
        <Chip status={r.status} />
      </div>
      <p className='mt-0.5 text-xs text-slate-500'>
        Prefers {r.preferredFrom} → {r.preferredTo}
      </p>
      {r.topic && <p className='mt-1 text-sm text-slate-600'>{r.topic}</p>}
      {r.status === 'offered' && <p className='mt-1 text-xs text-green-700'>{when(r)}</p>}
      {r.status === 'declined' && r.declineReason && (
        <p className='mt-1 text-xs text-red-600'>Declined: {r.declineReason}</p>
      )}
      {err && <p className='mt-1 text-xs text-red-600'>{apiErrorMessage(err)}</p>}

      {r.status === 'requested' && mode === 'idle' && (
        <div className='mt-2 flex gap-3'>
          <button
            type='button'
            onClick={() => setMode('offer')}
            className='rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-500'
          >
            Offer a time
          </button>
          <button
            type='button'
            onClick={() => setMode('decline')}
            className='text-xs text-red-600 hover:underline'
          >
            Decline
          </button>
        </div>
      )}
      {r.status === 'requested' && mode === 'offer' && (
        <div className='mt-2 grid gap-2 sm:grid-cols-4'>
          <input
            type='date'
            min={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
          <input
            type='time'
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
          <input
            type='time'
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder='Where (optional)'
            className={inputClass}
          />
          <div className='flex gap-3 sm:col-span-4'>
            <button
              type='button'
              disabled={offer.isPending || !date || endTime <= startTime}
              onClick={() => offer.mutate()}
              className='rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40'
            >
              {offer.isPending ? 'Sending…' : 'Send the time'}
            </button>
            <button
              type='button'
              onClick={() => setMode('idle')}
              className='text-xs text-slate-400 hover:text-slate-600'
            >
              Back
            </button>
          </div>
        </div>
      )}
      {r.status === 'requested' && mode === 'decline' && (
        <div className='mt-2 flex flex-wrap items-center gap-2'>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Why? (they see this)'
            className='min-w-[14rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none'
          />
          <button
            type='button'
            disabled={decline.isPending || reason.trim().length < 3}
            onClick={() => decline.mutate()}
            className='rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40'
          >
            Decline
          </button>
          <button
            type='button'
            onClick={() => setMode('idle')}
            className='text-xs text-slate-400 hover:text-slate-600'
          >
            Back
          </button>
        </div>
      )}
    </li>
  );
};

/**
 * Session requests (test-pass fix 2026-10-22): when no published open-door
 * slot suits, ask HR or a department head for a time; they offer one (it
 * lands as a booked slot) or decline. Hosts and concern handlers answer the
 * requests addressed to them here too.
 */
const SessionRequests = () => {
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ['open-door-requests'], queryFn: openDoorApi.requests });
  const hosts = useQuery({ queryKey: ['open-door-hosts'], queryFn: openDoorApi.hosts });
  const me = useQuery({ queryKey: ['open-door-me'], queryFn: openDoorApi.me });
  const horizon = me.data?.horizonDays ?? 21;

  const [hostId, setHostId] = useState('');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(plusDays(7));
  const [topic, setTopic] = useState('');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['open-door-requests'] });
    queryClient.invalidateQueries({ queryKey: ['open-door-me'] });
    queryClient.invalidateQueries({ queryKey: ['open-door-slots'] });
  };
  const create = useMutation({
    mutationFn: () =>
      openDoorApi.createRequest({
        hostId,
        preferredFrom: from,
        preferredTo: to,
        ...(topic.trim() ? { topic: topic.trim() } : {}),
      }),
    onSuccess: () => {
      setTopic('');
      setHostId('');
      refresh();
    },
  });
  const cancel = useMutation({ mutationFn: openDoorApi.cancelRequest, onSuccess: refresh });
  const valid = hostId !== '' && from >= today() && to >= from;

  const incoming = requests.data?.incoming ?? [];
  const waiting = incoming.filter((r) => r.status === 'requested');
  const answered = incoming.filter((r) => r.status !== 'requested').slice(0, 10);

  return (
    <div className='space-y-4'>
      {incoming.length > 0 && (
        <div className='rounded-xl border border-amber-200 bg-amber-50/40 p-5'>
          <h2 className='text-sm font-semibold text-slate-700'>Asked of you</h2>
          <p className='text-xs text-slate-400'>
            Offer a time (it becomes a booked session) or decline with a reason.
          </p>
          {waiting.length === 0 && (
            <p className='mt-2 text-sm text-slate-400'>Nothing waiting on you.</p>
          )}
          <ul className='mt-3 space-y-2'>
            {[...waiting, ...answered].map((r) => (
              <AnswerRow key={r.id} r={r} onDone={refresh} />
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
        className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'
      >
        <div>
          <h2 className='text-sm font-semibold text-slate-700'>Request a session</h2>
          <p className='text-xs text-slate-400'>
            No open-door slot that works? Ask HR or a department head directly — they reply with a
            time. To talk about one of your concerns, use &ldquo;Request a meeting&rdquo; on the
            case instead.
          </p>
        </div>
        <div className='grid gap-3 sm:grid-cols-3'>
          <label className='text-xs text-slate-500'>
            With
            <select
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value=''>Choose…</option>
              {(hosts.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.designation ? ` — ${h.designation}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className='text-xs text-slate-500'>
            Any time from
            <input
              type='date'
              min={today()}
              max={plusDays(horizon)}
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
              max={plusDays(horizon)}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        <label className='block text-xs text-slate-500'>
          What about? (optional — only they see it)
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={500}
            rows={2}
            className={`${inputClass} mt-1`}
          />
        </label>
        {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}
        <div className='flex justify-end'>
          <button
            type='submit'
            disabled={!valid || create.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
          >
            {create.isPending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>My requests</h2>
        {requests.isLoading && <p className='mt-2 text-sm text-slate-400'>Loading…</p>}
        {requests.error && (
          <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(requests.error)}</p>
        )}
        {requests.data?.mine.length === 0 && (
          <p className='mt-2 text-sm text-slate-400'>No requests yet.</p>
        )}
        {cancel.error && (
          <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(cancel.error)}</p>
        )}
        <ul className='mt-3 space-y-2'>
          {(requests.data?.mine ?? []).map((r) => (
            <li key={r.id} className='rounded-lg border border-slate-100 p-3'>
              <div className='flex flex-wrap items-baseline justify-between gap-2'>
                <span className='text-sm text-slate-800'>To {target(r)}</span>
                <Chip status={r.status} />
              </div>
              <p className='mt-0.5 text-xs text-slate-500'>
                Asked for {r.preferredFrom} → {r.preferredTo}
              </p>
              {r.status === 'offered' && (
                <p className='mt-1 text-sm font-medium text-green-700'>{when(r)}</p>
              )}
              {r.status === 'declined' && r.declineReason && (
                <p className='mt-1 text-xs text-red-600'>Declined: {r.declineReason}</p>
              )}
              {r.status === 'requested' && (
                <button
                  type='button'
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(r.id)}
                  className='mt-2 text-xs text-slate-500 hover:underline disabled:opacity-50'
                >
                  Withdraw
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SessionRequests;

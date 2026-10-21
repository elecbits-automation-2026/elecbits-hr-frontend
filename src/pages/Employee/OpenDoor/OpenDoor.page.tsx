import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OpenDoorBookingStatus, OpenDoorSlot } from '@app-types/api.types';
import { openDoorApi } from '@services/api/openDoor.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const primary =
  'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40';
const secondary =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40';

const today = () => new Date().toLocaleDateString('en-CA');
const nowHhmm = () => new Date().toTimeString().slice(0, 5);
const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
const started = (s: OpenDoorSlot) =>
  s.date < today() || (s.date === today() && s.startTime <= nowHhmm());

const BOOKING_LABEL: Record<OpenDoorBookingStatus, string> = {
  booked: 'Booked',
  done: 'Met',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
const BOOKING_CLASS: Record<OpenDoorBookingStatus, string> = {
  booked: 'bg-sky-50 text-sky-700',
  done: 'bg-green-50 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-50 text-red-700',
};

const chip = (s: OpenDoorBookingStatus) => (
  <span className={`rounded-full px-2 py-0.5 text-xs ${BOOKING_CLASS[s]}`}>{BOOKING_LABEL[s]}</span>
);

/** Book a seat on someone's slot, with an optional private topic. */
const SlotRow = ({ slot, onDone }: { slot: OpenDoorSlot; onDone: () => void }) => {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const book = useMutation({
    mutationFn: () => openDoorApi.book(slot.id, topic.trim() || undefined),
    onSuccess: () => {
      setOpen(false);
      setTopic('');
      onDone();
    },
  });
  const full = slot.booked >= slot.capacity;
  return (
    <li className='rounded-lg border border-slate-200 p-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-sm font-medium text-slate-800'>
          {fmtDay(slot.date)} · {slot.startTime}–{slot.endTime}
        </span>
        <span className='text-xs text-slate-400'>
          {slot.booked}/{slot.capacity} booked
        </span>
        <span className='ml-auto'>
          {slot.myBookingId ? (
            chip('booked')
          ) : (
            <button
              type='button'
              disabled={full}
              onClick={() => setOpen(!open)}
              className={full ? secondary : primary}
            >
              {full ? 'Full' : 'Book'}
            </button>
          )}
        </span>
      </div>
      {slot.note && <p className='mt-1 text-xs text-slate-500'>{slot.note}</p>}
      {open && (
        <div className='mt-2 space-y-2'>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={`What would you like to talk about? Optional — only ${slot.owner.name} sees it.`}
            className={inputClass}
          />
          {book.error && <p className='text-sm text-red-600'>{apiErrorMessage(book.error)}</p>}
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => setOpen(false)} className={secondary}>
              Back
            </button>
            <button
              type='button'
              disabled={book.isPending}
              onClick={() => book.mutate()}
              className={primary}
            >
              {book.isPending ? 'Booking…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

/** Publishers: offer a slot. */
const NewSlotForm = ({ horizonDays, onDone }: { horizonDays: number; onDone: () => void }) => {
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('16:30');
  const [capacity, setCapacity] = useState('1');
  const [note, setNote] = useState('');
  const create = useMutation({
    mutationFn: () =>
      openDoorApi.createSlot({
        date,
        startTime,
        endTime,
        capacity: Number(capacity) || 1,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      setNote('');
      onDone();
    },
  });
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        create.mutate();
      }}
      className='space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4'
    >
      <div className='grid gap-3 sm:grid-cols-4'>
        <label className='text-xs text-slate-500'>
          Date
          <input
            type='date'
            min={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className='text-xs text-slate-500'>
          From
          <input
            type='time'
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className='text-xs text-slate-500'>
          To
          <input
            type='time'
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className='text-xs text-slate-500'>
          Seats
          <input
            type='number'
            min={1}
            max={20}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <label className='block text-xs text-slate-500'>
        Note (optional — where, how)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder='e.g. Meeting room 2, or a Meet link on booking'
          className={`${inputClass} mt-1`}
        />
      </label>
      {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs text-slate-400'>
          People can book up to {horizonDays} days ahead.
        </span>
        <button
          type='submit'
          disabled={endTime <= startTime || create.isPending}
          className={primary}
        >
          {create.isPending ? 'Publishing…' : 'Publish slot'}
        </button>
      </div>
    </form>
  );
};

/**
 * Open door: talk to HR or a department head in a slot they've offered.
 * Bookable slots are grouped by person; your bookings can be cancelled until
 * they start. Publishers also manage their own slots and mark each booking
 * met or no-show afterwards.
 */
const OpenDoorPage = () => {
  const queryClient = useQueryClient();
  const slots = useQuery({ queryKey: ['open-door-slots'], queryFn: openDoorApi.slots });
  const me = useQuery({ queryKey: ['open-door-me'], queryFn: openDoorApi.me });
  const [showNew, setShowNew] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['open-door-slots'] });
    queryClient.invalidateQueries({ queryKey: ['open-door-me'] });
  };
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
  });

  const byOwner = new Map<string, { name: string; slots: OpenDoorSlot[] }>();
  for (const s of slots.data ?? []) {
    const e = byOwner.get(s.owner.id) ?? { name: s.owner.name, slots: [] };
    e.slots.push(s);
    byOwner.set(s.owner.id, e);
  }
  const upcoming = (me.data?.bookings ?? []).filter(
    (b) => b.status === 'booked' && !started(b.slot),
  );
  const past = (me.data?.bookings ?? []).filter((b) => !upcoming.includes(b));

  return (
    <div className='w-full max-w-3xl space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Open door</h1>
        <p className='text-sm text-slate-500'>
          Book time with HR or a department head to talk about anything — no case, no form. What you
          write as the topic is seen only by the person you book.
        </p>
      </div>
      {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>My bookings</h2>
        {upcoming.length === 0 && <p className='mt-2 text-sm text-slate-400'>Nothing booked.</p>}
        <ul className='mt-3 space-y-2'>
          {upcoming.map((b) => (
            <li
              key={b.id}
              className='flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3'
            >
              <span className='text-sm font-medium text-slate-800'>
                {b.slot.owner.name} · {fmtDay(b.slot.date)} · {b.slot.startTime}–{b.slot.endTime}
              </span>
              {chip(b.status)}
              <button
                type='button'
                disabled={act.isPending}
                onClick={() => act.mutate(() => openDoorApi.cancelBooking(b.id))}
                className={`${secondary} ml-auto`}
              >
                Cancel
              </button>
              {b.slot.note && <p className='w-full text-xs text-slate-500'>{b.slot.note}</p>}
              {b.topic && <p className='w-full text-xs text-slate-400'>Topic: {b.topic}</p>}
            </li>
          ))}
        </ul>
        {past.length > 0 && (
          <details className='mt-3'>
            <summary className='cursor-pointer text-xs text-slate-500'>
              Earlier ({past.length})
            </summary>
            <ul className='mt-2 space-y-1'>
              {past.map((b) => (
                <li key={b.id} className='flex items-center gap-2 text-sm text-slate-600'>
                  {b.slot.owner.name} · {fmtDay(b.slot.date)} {b.slot.startTime} {chip(b.status)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-sm font-semibold text-slate-700'>Available slots</h2>
        {slots.isLoading && <p className='mt-2 text-sm text-slate-400'>Loading…</p>}
        {slots.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(slots.error)}</p>}
        {slots.data?.length === 0 && (
          <p className='mt-2 text-sm text-slate-400'>
            No open slots in the next {me.data?.horizonDays ?? 21} days.
          </p>
        )}
        <div className='mt-3 space-y-4'>
          {[...byOwner.entries()].map(([id, o]) => (
            <div key={id}>
              <h3 className='text-sm font-medium text-slate-700'>{o.name}</h3>
              <ul className='mt-2 space-y-2'>
                {o.slots.map((s) => (
                  <SlotRow key={s.id} slot={s} onDone={refresh} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {me.data?.canPublish && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <div className='flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-slate-700'>My slots</h2>
            <button type='button' onClick={() => setShowNew(!showNew)} className={secondary}>
              {showNew ? 'Close' : 'Offer a slot'}
            </button>
          </div>
          {showNew && (
            <div className='mt-3'>
              <NewSlotForm
                horizonDays={me.data.horizonDays}
                onDone={() => {
                  setShowNew(false);
                  refresh();
                }}
              />
            </div>
          )}
          {me.data.slots.length === 0 && (
            <p className='mt-2 text-sm text-slate-400'>You haven&rsquo;t offered any slots.</p>
          )}
          <ul className='mt-3 space-y-2'>
            {me.data.slots.map((s) => {
              const live = s.bookings.filter((b) => b.status !== 'cancelled');
              return (
                <li
                  key={s.id}
                  className={`rounded-lg border p-3 ${
                    s.cancelled ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200'
                  }`}
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-sm font-medium text-slate-800'>
                      {fmtDay(s.date)} · {s.startTime}–{s.endTime}
                    </span>
                    <span className='text-xs text-slate-400'>
                      {s.booked}/{s.capacity} booked
                    </span>
                    {s.cancelled ? (
                      <span className='ml-auto text-xs text-slate-500'>Cancelled</span>
                    ) : (
                      !started(s) && (
                        <button
                          type='button'
                          disabled={act.isPending}
                          onClick={() => act.mutate(() => openDoorApi.cancelSlot(s.id))}
                          className={`${secondary} ml-auto`}
                        >
                          Cancel slot
                        </button>
                      )
                    )}
                  </div>
                  {live.length > 0 && (
                    <ul className='mt-2 space-y-1'>
                      {live.map((b) => (
                        <li
                          key={b.id}
                          className='flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm'
                        >
                          <span className='text-slate-700'>{b.employee.name}</span>
                          {chip(b.status)}
                          {b.status === 'booked' && started(s) && !s.cancelled && (
                            <span className='ml-auto flex gap-1'>
                              <button
                                type='button'
                                disabled={act.isPending}
                                onClick={() => act.mutate(() => openDoorApi.mark(b.id, 'done'))}
                                className={secondary}
                              >
                                Met
                              </button>
                              <button
                                type='button'
                                disabled={act.isPending}
                                onClick={() => act.mutate(() => openDoorApi.mark(b.id, 'no_show'))}
                                className={secondary}
                              >
                                No-show
                              </button>
                            </span>
                          )}
                          {b.topic && (
                            <p className='w-full text-xs text-slate-500'>Topic: {b.topic}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OpenDoorPage;

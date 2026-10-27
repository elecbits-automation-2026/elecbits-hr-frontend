import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Application, InterviewMode, InterviewRound } from '@app-types/api.types';
import {
  MODE_LABEL,
  ROUND_LABEL,
  SLOT_STATUS_CLASS,
  SLOT_STATUS_LABEL,
  slotWhen,
} from '@constants/Common/hiring.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none';
const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';
const primary =
  'rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50';

/** '2026-10-28T15:00' (local, from the picker) ⇄ ISO. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PLACEHOLDER: Record<InterviewMode, string> = {
  in_person: 'Room / address',
  video: 'Meeting link',
  phone: 'Phone number',
};

/**
 * When each round happens (learner, 2026-10-27): the position's recruiter or
 * the line's TA RM schedules a round with its interviewer, moves it, or calls
 * it off (cancelled / did not show). The interviewer sees it on My interviews.
 */
const RoundSchedule = ({ app, canSchedule }: { app: Application; canSchedule: boolean }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<InterviewRound | null>(null);
  const [ending, setEnding] = useState<InterviewRound | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<InterviewMode>('video');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const done = () => {
    setEditing(null);
    setEnding(null);
    setReason('');
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['candidates'] });
    queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
  };
  const save = useMutation({
    mutationFn: (round: InterviewRound) =>
      candidatesApi.schedule(app.id, round, {
        startsAt: new Date(startsAt).toISOString(),
        durationMin: duration,
        mode,
        location: location.trim() || undefined,
      }),
    onSuccess: done,
  });
  const end = useMutation({
    mutationFn: ({ round, noShow }: { round: InterviewRound; noShow: boolean }) =>
      candidatesApi.endSlot(app.id, round, { noShow, reason: reason.trim() }),
    onSuccess: done,
  });
  const open = (round: InterviewRound) => {
    const live = app.rounds.find((r) => r.round === round)?.slot;
    const keep = live?.status === 'scheduled';
    setStartsAt(keep ? toLocalInput(live.startsAt) : '');
    setDuration(keep ? live.durationMin : 60);
    setMode(keep ? live.mode : 'video');
    setLocation(keep ? (live.location ?? '') : '');
    save.reset();
    setEnding(null);
    setEditing(round);
  };

  return (
    <div className='space-y-1.5'>
      <p className='text-[10px] font-semibold uppercase tracking-wide text-slate-400'>
        Interview schedule
      </p>
      {app.rounds.map((r) => {
        const s = r.slot;
        const live = s?.status === 'scheduled';
        return (
          <div key={r.round} className='rounded-md bg-slate-50 px-2.5 py-2 text-xs'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='text-slate-700'>
                <span className='font-medium'>{ROUND_LABEL[r.round]}</span> ·{' '}
                {r.interviewerName ?? 'no interviewer yet'}
                {s && (
                  <>
                    {' · '}
                    <span className='font-mono'>{slotWhen(s.startsAt)}</span> ·{' '}
                    {MODE_LABEL[s.mode]}
                    {s.location && <> · {s.location}</>}
                  </>
                )}
              </span>
              <span className='flex items-center gap-1.5'>
                {r.score ? (
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      r.score.recommendation === 'hire'
                        ? SLOT_STATUS_CLASS.done
                        : SLOT_STATUS_CLASS.no_show
                    }`}
                  >
                    {r.score.recommendation === 'hire' ? 'Passed' : 'Not selected'}
                  </span>
                ) : app.stage === 'interviewing' && app.currentRound !== r.round ? (
                  <span className='text-slate-400'>Opens after the round before passes</span>
                ) : s ? (
                  <span className={`rounded-full px-2 py-0.5 ${SLOT_STATUS_CLASS[s.status]}`}>
                    {SLOT_STATUS_LABEL[s.status]}
                  </span>
                ) : (
                  <span className='text-slate-400'>Not scheduled</span>
                )}
                {canSchedule &&
                  !r.score &&
                  app.stage === 'interviewing' &&
                  app.currentRound === r.round &&
                  r.interviewerId && (
                  <>
                    <button type='button' onClick={() => open(r.round)} className={btn}>
                      {live ? 'Move' : 'Schedule'}
                    </button>
                    {live && (
                      <button
                        type='button'
                        onClick={() => {
                          end.reset();
                          setEditing(null);
                          setEnding(ending === r.round ? null : r.round);
                        }}
                        className={btn}
                      >
                        Call off
                      </button>
                    )}
                  </>
                )}
              </span>
            </div>
            {s?.endReason && !live && <p className='mt-1 text-slate-500'>{s.endReason}</p>}
            {editing === r.round && (
              <div className='mt-2 grid gap-2 sm:grid-cols-[1.4fr_0.8fr_1fr]'>
                <input
                  type='datetime-local'
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  aria-label='Date and time'
                  className={input}
                />
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  aria-label='Duration'
                  className={input}
                >
                  {[30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as InterviewMode)}
                  aria-label='Mode'
                  className={input}
                >
                  {(Object.keys(MODE_LABEL) as InterviewMode[]).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={PLACEHOLDER[mode]}
                  className={`${input} sm:col-span-3`}
                />
                {save.error && (
                  <p className='text-red-600 sm:col-span-3'>{apiErrorMessage(save.error)}</p>
                )}
                <div className='flex justify-end gap-2 sm:col-span-3'>
                  <button type='button' onClick={() => setEditing(null)} className={btn}>
                    Cancel
                  </button>
                  <button
                    type='button'
                    disabled={!startsAt || save.isPending}
                    onClick={() => save.mutate(r.round)}
                    className={primary}
                  >
                    {live ? 'Move it' : 'Schedule'} — {r.interviewerName} is told
                  </button>
                </div>
              </div>
            )}
            {ending === r.round && (
              <div className='mt-2 space-y-2'>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder='Why? (the interviewer sees this)'
                  className={input}
                />
                {end.error && <p className='text-red-600'>{apiErrorMessage(end.error)}</p>}
                <div className='flex justify-end gap-2'>
                  <button
                    type='button'
                    disabled={!reason.trim() || end.isPending}
                    onClick={() => end.mutate({ round: r.round, noShow: true })}
                    className={btn}
                  >
                    Candidate did not show
                  </button>
                  <button
                    type='button'
                    disabled={!reason.trim() || end.isPending}
                    onClick={() => end.mutate({ round: r.round, noShow: false })}
                    className={primary}
                  >
                    Cancel the interview
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RoundSchedule;

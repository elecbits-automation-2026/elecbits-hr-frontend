import { useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { Concern, ConcernOutcome } from '@app-types/api.types';
import {
  LEVEL_LABELS,
  OUTCOME_LABELS,
  STATUS_CLASS,
  STATUS_LABELS,
  TRACK_LABELS,
  categoryLabel,
  dueLine,
  fmtDate,
} from '@constants/Common/concerns.constants';
import RequestMeeting from '@components/Employee/OpenDoor/RequestMeeting.component';
import { concernsApi } from '@services/api/concerns.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const primary =
  'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40';
const secondary =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
const today = () => new Date().toLocaleDateString('en-CA');

export const StatusChip = ({ c }: { c: Concern }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[c.status]}`}>
    {STATUS_LABELS[c.status]}
    {c.track === 'dispute' && c.level && !['closed', 'declined'].includes(c.status)
      ? ` · L${c.level}`
      : ''}
  </span>
);

type Mode = 'raiser' | 'handler' | 'followup';

/**
 * One case: header, details, the thread and the actions the backend says the
 * caller may take (`can`). Handlers see internal notes (marked) and choose
 * reply vs internal; the raiser sees replies and decisions only. In follow-up
 * mode (anonymous raiser) the note goes through `onFollowUpNote`.
 */
const ConcernCase = ({
  concern: c,
  mode,
  onChanged,
  onFollowUpNote,
}: {
  concern: Concern;
  mode: Mode;
  onChanged: (c: Concern) => void;
  onFollowUpNote?: (body: string) => Promise<Concern>;
}) => {
  const [panel, setPanel] = useState<
    null | 'decide' | 'resolve' | 'extend' | 'decline' | 'escalate'
  >(null);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [outcome, setOutcome] = useState<ConcernOutcome>('substantiated');
  const [related, setRelated] = useState('');
  const [note, setNote] = useState('');
  const [reply, setReply] = useState(mode !== 'handler');

  const act = useMutation({
    mutationFn: (fn: () => Promise<Concern>) => fn(),
    onSuccess: (next) => {
      setPanel(null);
      setText('');
      setNote('');
      onChanged(next);
    },
  });

  const run = (fn: () => Promise<Concern>) => act.mutate(fn);
  const due = dueLine(c);
  const live = !['closed', 'declined', 'resolved'].includes(c.status);

  const panelForm = (
    label: string,
    min: number,
    submit: () => Promise<Concern>,
    extra?: ReactNode,
  ) => (
    <div className='space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3'>
      {extra}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={label}
        className={inputClass}
      />
      <div className='flex items-center justify-end gap-2'>
        <span className='mr-auto text-xs text-slate-400'>At least {min} characters.</span>
        <button type='button' onClick={() => setPanel(null)} className={secondary}>
          Back
        </button>
        <button
          type='button'
          disabled={text.trim().length < min || act.isPending}
          onClick={() => run(submit)}
          className={primary}
        >
          {act.isPending ? 'Saving…' : 'Send'}
        </button>
      </div>
    </div>
  );

  return (
    <div className='space-y-4'>
      <div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-mono text-xs text-slate-500'>{c.code}</span>
          <StatusChip c={c} />
          <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>
            {TRACK_LABELS[c.track]} · {categoryLabel(c.track, c.category)}
          </span>
          {c.anonymous && (
            <span className='rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white'>
              Anonymous
            </span>
          )}
        </div>
        <h3 className='mt-2 text-lg font-semibold text-slate-800'>{c.title}</h3>
        <p className='mt-1 text-xs text-slate-400'>
          Raised {fmtDate(c.createdAt)}
          {mode === 'handler' && c.raisedBy ? ` by ${c.raisedBy.name}` : ''}
          {c.subject ? ` · about ${c.subject.name}` : ''}
          {c.relatedCode ? ` · related to ${c.relatedCode}` : ''}
          {due ? ` · ${due}` : ''}
        </p>
        {c.track === 'dispute' && c.level && (
          <p className='mt-1 text-xs text-slate-500'>{LEVEL_LABELS[c.level]}</p>
        )}
      </div>

      <p className='whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700'>
        {c.detail}
      </p>

      {c.outcome && (
        <div className='rounded-lg border border-green-200 bg-green-50/50 p-3 text-sm'>
          <p className='font-medium text-green-800'>Outcome: {OUTCOME_LABELS[c.outcome]}</p>
          {c.resolution && (
            <p className='mt-1 whitespace-pre-wrap text-slate-700'>{c.resolution}</p>
          )}
        </div>
      )}

      <div>
        <h4 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Thread</h4>
        {c.notes.length === 0 && <p className='mt-2 text-sm text-slate-400'>Nothing yet.</p>}
        <ul className='mt-2 space-y-2'>
          {c.notes.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 text-sm ${
                n.kind === 'decision'
                  ? 'border-violet-200 bg-violet-50/50'
                  : !n.visibleToRaiser
                    ? 'border-dashed border-amber-300 bg-amber-50/40'
                    : n.kind === 'system'
                      ? 'border-slate-100 bg-slate-50'
                      : 'border-slate-200 bg-white'
              }`}
            >
              <p className='text-xs text-slate-400'>
                {n.fromRaiser ? (n.authorName ?? 'Raiser (anonymous)') : (n.authorName ?? 'System')}
                {n.kind === 'decision' ? ` · decision${n.level ? ` (L${n.level})` : ''}` : ''}
                {!n.visibleToRaiser ? ' · internal note' : ''} · {fmtTime(n.createdAt)}
              </p>
              <p className='mt-1 whitespace-pre-wrap text-slate-700'>{n.body}</p>
            </li>
          ))}
        </ul>
      </div>

      {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}

      {/* Raiser of a named, live case: ask to talk it through. */}
      {mode === 'raiser' && live && !c.anonymous && (
        <RequestMeeting
          concernId={c.id}
          onSent={() => void concernsApi.get(c.id).then(onChanged)}
        />
      )}

      {/* Raiser decisions on a dispute level. */}
      {mode === 'raiser' && c.status === 'decided' && (c.can.accept || c.can.escalate) && (
        <div className='rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-sm text-slate-700'>
          <p>
            A decision has been made at level {c.level}.{' '}
            {c.can.escalate && c.escalateBy
              ? `Accept it, or escalate to the next level by ${fmtDate(c.escalateBy)}.`
              : 'This level is final.'}
          </p>
          <div className='mt-2 flex gap-2'>
            {c.can.accept && (
              <button
                type='button'
                disabled={act.isPending}
                onClick={() => run(() => concernsApi.accept(c.id))}
                className={primary}
              >
                Accept and close
              </button>
            )}
            {c.can.escalate && (
              <button type='button' onClick={() => setPanel('escalate')} className={secondary}>
                Escalate
              </button>
            )}
          </div>
        </div>
      )}

      {/* Handler actions. */}
      {mode === 'handler' && panel === null && (
        <div className='flex flex-wrap gap-2'>
          {c.can.acknowledge && (
            <button
              type='button'
              disabled={act.isPending}
              onClick={() => run(() => concernsApi.acknowledge(c.id))}
              className={primary}
            >
              Acknowledge
            </button>
          )}
          {c.can.decide && (
            <button type='button' onClick={() => setPanel('decide')} className={primary}>
              Write decision
            </button>
          )}
          {c.can.resolve && (
            <button type='button' onClick={() => setPanel('resolve')} className={primary}>
              Resolve
            </button>
          )}
          {c.can.extend && (
            <button type='button' onClick={() => setPanel('extend')} className={secondary}>
              Extend timeline
            </button>
          )}
          {c.can.decline && (
            <button type='button' onClick={() => setPanel('decline')} className={secondary}>
              Decline as repeat
            </button>
          )}
        </div>
      )}

      {panel === 'decide' &&
        panelForm('The decision and its reasons — the raiser sees this.', 10, () =>
          concernsApi.decide(c.id, text.trim()),
        )}
      {panel === 'escalate' &&
        panelForm('Why the decision should be reviewed at the next level.', 10, () =>
          concernsApi.escalate(c.id, text.trim()),
        )}
      {panel === 'resolve' &&
        panelForm(
          'What was found and what is being done — the raiser sees this.',
          10,
          () => concernsApi.resolve(c.id, { outcome, resolution: text.trim() }),
          <label className='block text-xs text-slate-500'>
            Outcome
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as ConcernOutcome)}
              className={`${inputClass} mt-1`}
            >
              {Object.entries(OUTCOME_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>,
        )}
      {panel === 'extend' &&
        panelForm(
          'Why more time is needed — sent to the raiser as written notice.',
          10,
          () => concernsApi.extend(c.id, { to: date, reason: text.trim() }),
          <label className='block text-xs text-slate-500'>
            New date
            <input
              type='date'
              min={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </label>,
        )}
      {panel === 'decline' &&
        panelForm(
          'Why this repeats a matter already decided — the raiser sees this.',
          10,
          () =>
            concernsApi.decline(c.id, {
              reason: text.trim(),
              ...(related.trim() ? { relatedCode: related.trim() } : {}),
            }),
          <label className='block text-xs text-slate-500'>
            Earlier case code (optional)
            <input
              value={related}
              onChange={(e) => setRelated(e.target.value)}
              placeholder='DSP-2026-001'
              className={`${inputClass} mt-1`}
            />
          </label>,
        )}

      {/* Add to the thread. */}
      {live && (c.can.note || mode === 'followup') && panel === null && (
        <div className='space-y-2'>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={
              mode === 'handler'
                ? reply
                  ? 'Reply — the raiser sees this.'
                  : 'Internal note — handlers only.'
                : 'Add information for the people handling this.'
            }
            className={inputClass}
          />
          <div className='flex items-center justify-between gap-2'>
            {mode === 'handler' ? (
              <label className='flex items-center gap-2 text-xs text-slate-500'>
                <input
                  type='checkbox'
                  checked={reply}
                  onChange={(e) => setReply(e.target.checked)}
                />
                Visible to the raiser
              </label>
            ) : (
              <span />
            )}
            <button
              type='button'
              disabled={note.trim().length < 2 || act.isPending}
              onClick={() =>
                run(() =>
                  mode === 'followup' && onFollowUpNote
                    ? onFollowUpNote(note.trim())
                    : concernsApi.note(c.id, {
                        body: note.trim(),
                        ...(mode === 'handler' ? { visibleToRaiser: reply } : {}),
                      }),
                )
              }
              className={primary}
            >
              {mode === 'handler' && !reply ? 'Add note' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcernCase;

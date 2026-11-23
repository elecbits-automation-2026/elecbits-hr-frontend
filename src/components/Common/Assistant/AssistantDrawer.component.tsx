import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '@hooks/Common/useDialogFocus.hook';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import type {
  AssistantNote,
  AssistantProposal,
  AssistantQuickQuestion,
  AssistantTurn,
} from '@app-types/api.types';
import { MY_PAYSLIPS_ROUTE } from '@constants/Common/navigation/routes.constants';
import { assistantApi, type AssistantError } from '@services/api/assistant.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * One message as shown. `cards` are the proposals / drafts the answer set
 * up; `quick` marks an offline-button answer (never sent back to the model).
 */
interface ShownTurn extends AssistantTurn {
  at: string;
  used?: string[];
  cards?: Array<AssistantProposal | AssistantNote>;
  quick?: boolean;
}

/** Where a proposal card stands after the user acts on it. */
type Outcome =
  | { state: 'busy' }
  | { state: 'done'; message: string }
  | { state: 'cancelled' }
  | { state: 'error'; message: string };

const EXAMPLES = [
  "Who's out today?",
  'Who missed a work update yesterday?',
  'Which joiners have no onboarding journey?',
  'Draft a PIP framing for someone missing their goals',
];

/** The model can't be reached: the offline buttons take over. */
const OFFLINE_CODES = new Set([
  'ASSISTANT_NOT_CONFIGURED',
  'ASSISTANT_KEY_INVALID',
  'ASSISTANT_MODEL_UNAVAILABLE',
]);

const QUICK: Array<{ question: AssistantQuickQuestion; label: string }> = [
  { question: 'out', label: "Who's out today" },
  { question: 'updates', label: "Who hasn't sent an update" },
  { question: 'cases', label: 'Open cases' },
];

const hhmm = () => new Date().toTimeString().slice(0, 5);

/** A draft: shown with Copy, never saved. */
const NoteCard = ({ note }: { note: AssistantNote }) => {
  const [copied, setCopied] = useState<'yes' | 'blocked' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied('yes');
    } catch {
      setCopied('blocked');
    }
  };
  return (
    <div className='overflow-hidden rounded-xl border border-slate-200 bg-white'>
      <div className='flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2'>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-semibold text-slate-800'>{note.title}</p>
          <p className='text-xs text-slate-500'>{note.kind}</p>
        </div>
        <button
          type='button'
          onClick={() => void copy()}
          className='rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100'
        >
          {copied === 'yes' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className='max-h-80 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 font-sans text-sm text-slate-800'>
        {note.content}
      </pre>
      <p className='border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500'>
        Draft only, not saved and not a record.
        {copied === 'blocked' && ' The clipboard is blocked here: select the text and copy it.'}
      </p>
    </div>
  );
};

/** An action the assistant set up: nothing happens until Confirm. */
const ProposalCard = ({
  proposal,
  outcome,
  onConfirm,
  onCancel,
  onNavigate,
}: {
  proposal: AssistantProposal;
  outcome: Outcome | undefined;
  onConfirm: () => void;
  onCancel: () => void;
  onNavigate: () => void;
}) => (
  <div className='overflow-hidden rounded-xl border border-brand-200 bg-white'>
    <div className='border-b border-brand-100 bg-brand-50 px-3 py-2'>
      <p className='text-sm font-semibold text-slate-800'>{proposal.title}</p>
      <p className='text-xs text-slate-500'>Waiting for your confirm, nothing saved yet</p>
    </div>
    <ul className='space-y-0.5 px-3 py-2 text-sm text-slate-700'>
      {proposal.lines.map((l, i) => (
        <li key={i} className='whitespace-pre-wrap break-words'>
          {l}
        </li>
      ))}
    </ul>
    <div className='border-t border-slate-200 px-3 py-2 text-sm'>
      {outcome?.state === 'done' ? (
        <p className='text-emerald-700'>
          Done. {outcome.message}{' '}
          <Link to={proposal.link} onClick={onNavigate} className='font-medium underline'>
            Open {proposal.linkLabel}
          </Link>
        </p>
      ) : outcome?.state === 'cancelled' ? (
        <p className='text-slate-500'>Cancelled. Nothing was saved.</p>
      ) : (
        <div className='space-y-2'>
          {outcome?.state === 'error' && <p className='text-red-600'>{outcome.message}</p>}
          <div className='flex gap-2'>
            <button
              type='button'
              disabled={outcome?.state === 'busy'}
              onClick={onConfirm}
              className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50'
            >
              {outcome?.state === 'busy'
                ? 'Saving…'
                : outcome?.state === 'error'
                  ? 'Try again'
                  : 'Confirm'}
            </button>
            <button
              type='button'
              disabled={outcome?.state === 'busy'}
              onClick={onCancel}
              className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50'
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);

/**
 * The HR Assistant drawer. The conversation lives in this component only —
 * chats are never stored, so closing the drawer and starting over clears it.
 * The backend decides what each person may ask about; actions arrive as
 * proposal cards and Confirm calls the app's existing endpoint for that
 * action with the user's own session.
 */
const AssistantDrawer = ({ onClose }: { onClose: () => void }) => {
  const [turns, setTurns] = useState<ShownTurn[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the model is unreachable (no key / bad key / no model).
  const [offline, setOffline] = useState(false);
  const [quickBusy, setQuickBusy] = useState<AssistantQuickQuestion | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const dialogRef = useDialogFocus<HTMLElement>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      abort.current?.abort();
    };
  }, [onClose]);

  // Block body on purpose: newer browsers return a value from scrollIntoView,
  // and an effect may only return a cleanup function.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [turns, outcomes]);

  /** Patch the answer being streamed (always the last turn). */
  const patchLast = (fn: (t: ShownTurn) => ShownTurn) =>
    setTurns((all) => [...all.slice(0, -1), fn(all[all.length - 1]!)]);

  const fail = (code: string | undefined, message: string) => {
    if (code && OFFLINE_CODES.has(code)) setOffline(true);
    setError(message);
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setDraft('');
    // Only finished model text goes back to the server; quick answers and
    // empty (card-only) answers are dropped.
    const history: AssistantTurn[] = [
      ...turns
        .filter((t) => !t.quick && t.content.trim())
        .map(({ role, content }) => ({ role, content })),
      { role: 'user', content: question },
    ].slice(-19) as AssistantTurn[];
    setTurns((all) => [
      ...all,
      { role: 'user', content: question, at: hhmm() },
      { role: 'assistant', content: '', used: [], at: hhmm() },
    ]);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await assistantApi.chat(
        history[0]?.role === 'assistant' ? history.slice(1) : history,
        (e) => {
          if (e.type === 'text') patchLast((t) => ({ ...t, content: t.content + e.delta }));
          if (e.type === 'tool') {
            patchLast((t) => ({
              ...t,
              used: t.used?.includes(e.label) ? t.used : [...(t.used ?? []), e.label],
            }));
          }
          if (e.type === 'proposal' || e.type === 'note') {
            patchLast((t) => ({ ...t, cards: [...(t.cards ?? []), e] }));
          }
          if (e.type === 'error') fail(e.code, e.message);
        },
        controller.signal,
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        const e = err as AssistantError;
        fail(e.code, e.message);
      }
    } finally {
      setBusy(false);
      abort.current = null;
      // A turn that produced nothing (refused, failed) is removed from the chat.
      setTurns((all) => {
        const last = all[all.length - 1];
        return last?.role === 'assistant' && !last.content.trim() && !last.cards?.length
          ? all.slice(0, -2)
          : all;
      });
    }
  };

  /** An offline button: one read on the server, no model. */
  const ask = async (question: AssistantQuickQuestion, label: string) => {
    if (quickBusy) return;
    setQuickBusy(question);
    setError(null);
    try {
      const r = await assistantApi.quick(question);
      setTurns((all) => [
        ...all,
        { role: 'user', content: label, at: hhmm(), quick: true },
        { role: 'assistant', content: r.text, used: [r.tool], at: hhmm(), quick: true },
      ]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setQuickBusy(null);
    }
  };

  const confirm = async (p: AssistantProposal) => {
    setOutcomes((o) => ({ ...o, [p.id]: { state: 'busy' } }));
    try {
      const message = await assistantApi.confirm(p);
      setOutcomes((o) => ({ ...o, [p.id]: { state: 'done', message } }));
    } catch (err) {
      setOutcomes((o) => ({ ...o, [p.id]: { state: 'error', message: apiErrorMessage(err) } }));
    }
  };

  const reset = () => {
    abort.current?.abort();
    setTurns([]);
    setOutcomes({});
    setError(null);
  };

  return createPortal(
    <div className='fixed inset-0 z-[60] flex justify-end bg-slate-900/30' onClick={onClose}>
      <aside
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-label='HR Assistant'
        onClick={(e) => e.stopPropagation()}
        className='flex h-full w-full max-w-lg flex-col bg-white shadow-xl'
      >
        <header className='flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4'>
          <div className='min-w-0'>
            <h2 className='text-lg font-semibold text-slate-800'>HR Assistant</h2>
            <p className='text-xs text-slate-500'>
              Answers from the HRMS, limited to what your access covers. Anything it sets up waits
              for your confirm. Chats are not saved.
            </p>
          </div>
          <div className='flex items-center gap-1'>
            {turns.length > 0 && (
              <button
                type='button'
                onClick={reset}
                className='rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100'
              >
                New chat
              </button>
            )}
            <button
              type='button'
              onClick={onClose}
              aria-label='Close'
              className='rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            >
              ×
            </button>
          </div>
        </header>

        <div className='flex-1 space-y-3 overflow-y-auto px-5 py-4'>
          {turns.length === 0 && !offline && (
            <div className='space-y-2'>
              <p className='text-sm text-slate-500'>Try asking:</p>
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type='button'
                  onClick={() => send(q)}
                  className='block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className='flex flex-col items-end gap-0.5'>
                <p className='px-1 text-xs font-medium text-slate-500'>You · {t.at}</p>
                <p className='max-w-[85%] whitespace-pre-wrap rounded-2xl bg-brand-600 px-3 py-2 text-sm text-white'>
                  {t.content}
                </p>
              </div>
            ) : (
              <div key={i} className='max-w-[95%] space-y-1'>
                <p className='px-1 text-xs font-medium text-slate-500'>
                  HR Assistant · {t.at}
                  {t.quick && ' · without the model'}
                </p>
                {(t.content || (busy && i === turns.length - 1)) && (
                  <p className='whitespace-pre-wrap rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-800'>
                    {t.content ||
                      (t.used?.length ? `Checking ${t.used[t.used.length - 1]}…` : 'Thinking…')}
                  </p>
                )}
                {t.cards?.map((c) =>
                  c.type === 'note' ? (
                    <NoteCard key={c.id} note={c} />
                  ) : (
                    <ProposalCard
                      key={c.id}
                      proposal={c}
                      outcome={outcomes[c.id]}
                      onConfirm={() => void confirm(c)}
                      onCancel={() =>
                        setOutcomes((o) => ({ ...o, [c.id]: { state: 'cancelled' } }))
                      }
                      onNavigate={onClose}
                    />
                  ),
                )}
                {!!t.used?.length && (
                  <p className='flex flex-wrap gap-1 text-xs text-slate-500'>
                    Used:
                    {t.used.map((u) => (
                      <span key={u} className='rounded-full bg-slate-100 px-2 py-0.5'>
                        {u}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ),
          )}
          {error && <p className='text-sm text-red-600'>{error}</p>}
          <div ref={bottom} />
        </div>

        {offline && (
          <div className='space-y-2 border-t border-amber-200 bg-amber-50 px-4 py-3'>
            <p className='text-xs text-amber-800'>
              The AI model can't be reached right now. These answers work without it:
            </p>
            <div className='flex flex-wrap gap-2'>
              {QUICK.map((q) => (
                <button
                  key={q.question}
                  type='button'
                  disabled={quickBusy !== null}
                  onClick={() => void ask(q.question, q.label)}
                  className='rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-amber-100 disabled:opacity-50'
                >
                  {quickBusy === q.question ? 'Checking…' : q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className='border-t border-slate-200 px-4 py-2 text-xs leading-relaxed text-slate-500'>
          I don't discuss pay. For payslips see{' '}
          <Link
            to={MY_PAYSLIPS_ROUTE}
            onClick={onClose}
            className='font-medium text-brand-700 underline'
          >
            Payroll
          </Link>
          . Harassment or POSH matters go to the Internal Committee or HR directly; nothing about
          them is handled or recorded here.
        </p>

        <form
          className='flex items-end gap-2 border-t border-slate-200 p-3'
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            aria-label='Ask about your team, attendance, goals, policies… or ask it to set something up'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder='Ask about your team, attendance, goals, policies… or ask it to set something up'
            className='flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          {busy ? (
            <button
              type='button'
              onClick={() => abort.current?.abort()}
              className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100'
            >
              Stop
            </button>
          ) : (
            <button
              type='submit'
              disabled={!draft.trim()}
              className='rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50'
            >
              Send
            </button>
          )}
        </form>
      </aside>
    </div>,
    document.body,
  );
};

/** The floating "Ask HR Assistant" button and its drawer. */
export const AssistantLauncher = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='fixed bottom-5 right-5 z-30 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-brand-700'
      >
        Ask HR Assistant
      </button>
      {open && <AssistantDrawer onClose={() => setOpen(false)} />}
    </>
  );
};

export default AssistantDrawer;

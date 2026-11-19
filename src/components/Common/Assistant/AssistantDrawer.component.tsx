import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AssistantTurn } from '@app-types/api.types';
import { assistantApi, type AssistantError } from '@services/api/assistant.api';

/** One answer as shown: the text so far plus the tools it used ("Used: …"). */
interface ShownTurn extends AssistantTurn {
  used?: string[];
}

const EXAMPLES = [
  "Who's out today?",
  'Who missed a work update yesterday?',
  'Which joiners have no onboarding journey?',
  "What's our work-from-home policy?",
];

/**
 * The HR Assistant drawer (phase 1, read-only). The conversation lives in
 * this component only — chats are never stored, so closing the drawer and
 * starting over clears it. The backend decides what each person may ask
 * about; this is just the window onto it.
 */
const AssistantDrawer = ({ onClose }: { onClose: () => void }) => {
  const [turns, setTurns] = useState<ShownTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      abort.current?.abort();
    };
  }, [onClose]);

  useEffect(() => bottom.current?.scrollIntoView({ block: 'end' }), [turns]);

  /** Patch the answer being streamed (always the last turn). */
  const patchLast = (fn: (t: ShownTurn) => ShownTurn) =>
    setTurns((all) => [...all.slice(0, -1), fn(all[all.length - 1]!)]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setDraft('');
    // Only finished text turns go back to the server; an empty answer is dropped.
    const history: AssistantTurn[] = [
      ...turns.filter((t) => t.content.trim()).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: question },
    ].slice(-19) as AssistantTurn[];
    setTurns((all) => [
      ...all,
      { role: 'user', content: question },
      { role: 'assistant', content: '', used: [] },
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
          if (e.type === 'error') setError(e.message);
        },
        controller.signal,
      );
    } catch (err) {
      if (!controller.signal.aborted) setError((err as AssistantError).message);
    } finally {
      setBusy(false);
      abort.current = null;
      // A turn that produced no text (refused, failed) is removed from the chat.
      setTurns((all) => {
        const last = all[all.length - 1];
        return last?.role === 'assistant' && !last.content.trim()
          ? all.slice(0, -2)
          : all;
      });
    }
  };

  const reset = () => {
    abort.current?.abort();
    setTurns([]);
    setError(null);
  };

  return createPortal(
    <div className='fixed inset-0 z-[60] flex justify-end bg-slate-900/30' onClick={onClose}>
      <aside
        role='dialog'
        aria-label='HR Assistant'
        onClick={(e) => e.stopPropagation()}
        className='flex h-full w-full max-w-lg flex-col bg-white shadow-xl'
      >
        <header className='flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4'>
          <div className='min-w-0'>
            <h2 className='text-lg font-semibold text-slate-800'>HR Assistant</h2>
            <p className='text-xs text-slate-500'>
              Read-only answers from the HRMS, limited to what your access covers. Chats are not
              saved.
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
              className='rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700'
            >
              ×
            </button>
          </div>
        </header>

        <div className='flex-1 space-y-3 overflow-y-auto px-5 py-4'>
          {turns.length === 0 && (
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
              <div key={i} className='flex justify-end'>
                <p className='max-w-[85%] whitespace-pre-wrap rounded-2xl bg-brand-600 px-3 py-2 text-sm text-white'>
                  {t.content}
                </p>
              </div>
            ) : (
              <div key={i} className='max-w-[95%] space-y-1'>
                <p className='whitespace-pre-wrap rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-800'>
                  {t.content ||
                    (busy && i === turns.length - 1
                      ? t.used?.length
                        ? `Checking ${t.used[t.used.length - 1]}…`
                        : 'Thinking…'
                      : '')}
                </p>
                {!!t.used?.length && (
                  <p className='flex flex-wrap gap-1 text-[11px] text-slate-500'>
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

        <form
          className='flex items-end gap-2 border-t border-slate-200 p-3'
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <textarea
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
            placeholder='Ask about your team, attendance, onboarding, policies…'
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

import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { OnboardingJourney, OnboardingTask, OnboardingPhase } from '@app-types/api.types';
import { onboardingApi } from '@services/api/onboarding.api';
import { policiesApi } from '@services/api/policies.api';
import { apiErrorMessage } from '@utils/apiError';

const PHASES: Array<{ key: OnboardingPhase; title: string; offset: string }> = [
  { key: 'before_start', title: 'Before you start', offset: 'joining −7 days' },
  { key: 'week_one', title: 'Week one', offset: 'joining day' },
  { key: 'first_30', title: 'First 30 days', offset: 'joining +30 days' },
];

const OWNER_LABEL: Record<OnboardingTask['owner'], string> = {
  employee: 'the joiner',
  hr: 'HR',
  manager: 'their manager',
  admin: 'admin',
  ops: 'OPS',
  payroll: 'payroll',
};
const OWNER_LABEL_SELF: Record<OnboardingTask['owner'], string> = {
  ...OWNER_LABEL,
  employee: 'you',
  manager: 'your manager',
};

const MAX_BYTES = 10 * 1024 * 1024;
const day = (iso: string) => iso.slice(0, 10);

/** A document step: upload (or replace) the file, open what's there. */
const FileStep = ({ task, onChanged }: { task: OnboardingTask; onChanged: () => void }) => {
  const input = useRef<HTMLInputElement>(null);
  const [tooBig, setTooBig] = useState(false);
  const upload = useMutation({
    mutationFn: (file: File) => onboardingApi.uploadTaskFile(task.id, file),
    onSuccess: onChanged,
  });
  const open = useMutation({ mutationFn: () => onboardingApi.openTaskFile(task.id) });
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    upload.reset();
    // The server checks type and size too; this just saves a pointless upload.
    if (file.size > MAX_BYTES) {
      setTooBig(true);
      return;
    }
    setTooBig(false);
    upload.mutate(file);
  };
  const err = upload.error ?? open.error;
  return (
    <div className='flex shrink-0 flex-col items-end gap-1'>
      <div className='flex items-center gap-3 text-xs'>
        {task.file && (
          <button
            type='button'
            disabled={open.isPending}
            onClick={() => open.mutate()}
            className='text-brand-600 hover:underline'
          >
            View
          </button>
        )}
        {task.canAct && (
          <>
            <input
              ref={input}
              type='file'
              accept='application/pdf,image/jpeg,image/png'
              onChange={pick}
              className='hidden'
            />
            <button
              type='button'
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
              className='rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50'
            >
              {upload.isPending ? 'Uploading…' : task.file ? 'Replace' : 'Upload'}
            </button>
          </>
        )}
      </div>
      {tooBig && <p className='text-xs text-red-600'>The file must be under 10 MB.</p>}
      {err && <p className='text-xs text-red-600'>{apiErrorMessage(err)}</p>}
    </div>
  );
};

/** The Code of Conduct step, acknowledged right here by the joiner. */
const PolicyStep = ({ task, onChanged }: { task: OnboardingTask; onChanged: () => void }) => {
  const open = useMutation({ mutationFn: () => policiesApi.openDocument(task.policyId!) });
  const ack = useMutation({
    mutationFn: () => policiesApi.acknowledge(task.policyId!),
    onSuccess: onChanged,
  });
  if (!task.policyId) {
    return <span className='shrink-0 text-xs text-slate-400'>Not published yet — ask HR</span>;
  }
  return (
    <div className='flex shrink-0 flex-col items-end gap-1'>
      <div className='flex items-center gap-3 text-xs'>
        <button
          type='button'
          disabled={open.isPending}
          onClick={() => open.mutate()}
          className='text-brand-600 hover:underline'
        >
          Read
        </button>
        <button
          type='button'
          disabled={ack.isPending}
          onClick={() => ack.mutate()}
          className='rounded-md bg-brand-600 px-2.5 py-1 font-medium text-white hover:bg-brand-500 disabled:opacity-50'
        >
          {ack.isPending ? 'Saving…' : 'I have read it — acknowledge'}
        </button>
      </div>
      {(open.error ?? ack.error) && (
        <p className='text-xs text-red-600'>{apiErrorMessage(open.error ?? ack.error)}</p>
      )}
    </div>
  );
};

/** A plain step: tick with a short note of what was done; untick to undo. */
const TickStep = ({ task, onChanged }: { task: OnboardingTask; onChanged: () => void }) => {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const toggle = useMutation({
    mutationFn: (n?: string) => onboardingApi.toggleTask(task.id, n),
    onSuccess: () => {
      setNoting(false);
      setNote('');
      onChanged();
    },
  });
  if (!task.canAct) return null;
  return (
    <div className='flex shrink-0 flex-col items-end gap-1'>
      {task.done ? (
        <button
          type='button'
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(undefined)}
          className='text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50'
        >
          Undo
        </button>
      ) : noting ? (
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder='What was done? e.g. induction held on 6 Nov'
            className='w-64 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none'
          />
          <button
            type='button'
            disabled={note.trim().length < 3 || toggle.isPending}
            onClick={() => toggle.mutate(note.trim())}
            className='rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40'
          >
            Mark done
          </button>
          <button
            type='button'
            onClick={() => setNoting(false)}
            className='text-xs text-slate-400 hover:text-slate-600'
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type='button'
          onClick={() => setNoting(true)}
          className='rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50'
        >
          Mark done
        </button>
      )}
      {toggle.error && <p className='text-xs text-red-600'>{apiErrorMessage(toggle.error)}</p>}
    </div>
  );
};

/**
 * The three-phase checklist, shared by the joiner's page, the RM's "My team"
 * tab and the HR drill-in. Each step is acted on only by its OWNER — the
 * server says so per step (`canAct`, learner 2026-11-05). A hand tick needs a
 * note of what was done; the Code of Conduct is acknowledged right here by
 * the joiner; document steps complete by uploading the file; the account and
 * payroll steps complete on their own.
 */
const OnboardingChecklist = ({
  journey,
  selfView = false,
  onChanged,
}: {
  journey: OnboardingJourney;
  /** The joiner's own page: "waiting on you / your manager" wording, inline CoC ack. */
  selfView?: boolean;
  /** Refresh the journey after any change. */
  onChanged: () => void;
}) => {
  const labels = selfView ? OWNER_LABEL_SELF : OWNER_LABEL;
  return (
    <div className='space-y-4'>
      {PHASES.map((phase) => {
        const tasks = journey.tasks.filter((t) => t.phase === phase.key);
        if (tasks.length === 0) return null;
        const done = tasks.filter((t) => t.done).length;
        return (
          <div key={phase.key} className='rounded-xl border border-slate-200 bg-white p-5'>
            <div className='flex items-center justify-between'>
              <h2 className='text-sm font-semibold text-slate-700'>
                {phase.title}{' '}
                <span className='ml-1 text-xs font-normal text-slate-400'>({phase.offset})</span>
              </h2>
              <span className='text-xs text-slate-400'>
                {done}/{tasks.length}
              </span>
            </div>
            <div className='mt-3 divide-y divide-slate-100'>
              {tasks.map((t) => (
                <div key={t.id} className='flex flex-wrap items-center justify-between gap-3 py-2.5'>
                  <div className='flex min-w-0 items-start gap-3'>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                        t.done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {t.done ? '✓' : t.policyCode ? '§' : t.needsFile ? '⇪' : '•'}
                    </span>
                    <div className='min-w-0'>
                      <p
                        className={`text-sm ${t.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                      >
                        {t.title}
                      </p>
                      <p className='text-xs text-slate-400'>
                        {t.needsFile && t.file
                          ? `${t.file.fileName} · uploaded ${day(t.file.uploadedAt)}${
                              t.doneByName ? ` by ${t.doneByName}` : ''
                            }`
                          : t.done
                            ? t.policyCode
                              ? `acknowledged${t.doneAt ? ` ${day(t.doneAt)}` : ''}`
                              : t.doneByName
                                ? `done by ${t.doneByName}${t.doneAt ? ` · ${day(t.doneAt)}` : ''}`
                                : 'done by itself'
                            : t.policyCode
                              ? `waiting on ${labels.employee} to read and acknowledge it`
                              : t.auto
                                ? 'completes by itself'
                                : t.needsFile
                                  ? `waiting on ${labels[t.owner]} to upload it (PDF, JPG or PNG, up to 10 MB)`
                                  : `waiting on ${labels[t.owner]}`}
                      </p>
                      {t.done && t.doneNote && (
                        <p className='mt-0.5 text-xs text-slate-500'>“{t.doneNote}”</p>
                      )}
                    </div>
                  </div>
                  {t.policyCode && !t.done && selfView && (
                    <PolicyStep task={t} onChanged={onChanged} />
                  )}
                  {t.needsFile && <FileStep task={t} onChanged={onChanged} />}
                  {!t.policyCode && !t.needsFile && !t.auto && (
                    <TickStep task={t} onChanged={onChanged} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OnboardingChecklist;

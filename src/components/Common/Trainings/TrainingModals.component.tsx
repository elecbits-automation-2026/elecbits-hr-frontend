import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { Training, TrainingStream } from '@app-types/api.types';
import { guessStream, STREAM_LABEL, trainingsApi } from '@services/api/trainings.api';
import { apiErrorMessage } from '@utils/apiError';

import { useTrainingsInvalidate } from './useTrainingsInvalidate';
import ModalShell from '@components/Common/Utilities/ModalShell.component';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';
const primaryBtn =
  'rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50';
const secondaryBtn =
  'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50';

export interface AssignablePerson {
  id: string;
  name: string;
  department: string | null;
}

const Shell = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => (
  <ModalShell onClose={onClose}>
    <div className='max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
      <div className='flex items-start justify-between gap-4'>
        <h2 className='text-lg font-semibold text-slate-800'>{title}</h2>
        <button
          type='button'
          onClick={onClose}
          className='text-slate-500 hover:text-slate-600'
          aria-label='Close'
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </ModalShell>
);

const todayIso = () => new Date().toLocaleDateString('en-CA');

/**
 * Assign a training to one or several people. A manager's list is their own
 * reports; HR's is everyone (with "select a department"). Someone who already
 * has an open training with the same title is skipped, and the result says so.
 */
export const AssignTrainingModal = ({
  people,
  preselected = [],
  onClose,
}: {
  people: AssignablePerson[];
  preselected?: string[];
  onClose: () => void;
}) => {
  const invalidate = useTrainingsInvalidate();
  const [picked, setPicked] = useState<Set<string>>(new Set(preselected));
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [stream, setStream] = useState<TrainingStream | ''>('');
  const [streamTouched, setStreamTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [result, setResult] = useState<{ assigned: number; skipped: string[] } | null>(null);

  const departments = useMemo(
    () => [...new Set(people.map((p) => p.department ?? 'No department'))].sort(),
    [people],
  );
  const shown = people.filter((p) =>
    `${p.name} ${p.department ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const assign = useMutation({
    mutationFn: () =>
      trainingsApi.assign({
        employeeIds: [...picked],
        title: title.trim(),
        stream: stream as TrainingStream,
        description: description.trim() || undefined,
        link: link.trim() || undefined,
        dueOn: dueOn || undefined,
      }),
    onSuccess: (out) => {
      invalidate();
      setResult({ assigned: out.assigned, skipped: out.skipped.map((s) => s.name) });
    },
  });

  if (result) {
    return (
      <Shell title='Training assigned' onClose={onClose}>
        <p className='text-sm text-slate-700'>
          Assigned to {result.assigned} {result.assigned === 1 ? 'person' : 'people'}. Each of them
          got a bell.
        </p>
        {result.skipped.length > 0 && (
          <p className='text-sm text-amber-700'>
            Skipped (already have it open): {result.skipped.join(', ')}.
          </p>
        )}
        <div className='flex justify-end'>
          <button type='button' onClick={onClose} className={primaryBtn}>
            Done
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title='Assign a training' onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          assign.mutate();
        }}
        className='space-y-4'
      >
        <label className='block space-y-1'>
          <span className={labelClass}>Training</span>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!streamTouched) setStream(guessStream(e.target.value) ?? '');
            }}
            minLength={3}
            maxLength={120}
            required
            autoFocus
            placeholder='e.g. ESD handling basics'
          />
        </label>
        <label className='block space-y-1'>
          <span className={labelClass}>Stream</span>
          <select
            className={inputClass}
            value={stream}
            onChange={(e) => {
              setStream(e.target.value as TrainingStream);
              setStreamTouched(true);
            }}
            required
          >
            <option value=''>Choose…</option>
            {(Object.keys(STREAM_LABEL) as TrainingStream[]).map((s) => (
              <option key={s} value={s}>
                {STREAM_LABEL[s]}
              </option>
            ))}
          </select>
          {!streamTouched && stream && (
            <span className='text-xs text-slate-500'>
              Guessed from the title — change it if wrong.
            </span>
          )}
        </label>
        <label className='block space-y-1'>
          <span className={labelClass}>What to do (optional)</span>
          <textarea
            className={inputClass}
            rows={2}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className='grid gap-3 sm:grid-cols-2'>
          <label className='block space-y-1'>
            <span className={labelClass}>Link (optional)</span>
            <input
              type='url'
              className={inputClass}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder='https://…'
            />
          </label>
          <label className='block space-y-1'>
            <span className={labelClass}>Due by (optional)</span>
            <input
              type='date'
              className={inputClass}
              value={dueOn}
              min={todayIso()}
              onChange={(e) => setDueOn(e.target.value)}
            />
          </label>
        </div>

        <div className='space-y-2'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className={labelClass}>
              Who ({picked.size} picked of {people.length})
            </span>
            {departments.length > 1 && (
              <select
                aria-label='Add a person'
                className='rounded-md border border-slate-300 px-2 py-1 text-xs'
                value=''
                onChange={(e) => {
                  const dept = e.target.value;
                  if (!dept) return;
                  setPicked(
                    (prev) =>
                      new Set([
                        ...prev,
                        ...people
                          .filter((p) => (p.department ?? 'No department') === dept)
                          .map((p) => p.id),
                      ]),
                  );
                }}
              >
                <option value=''>Add a whole department…</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>
          {people.length > 6 && (
            <input
              aria-label='Search people'
              type='search'
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search people'
            />
          )}
          <ul className='max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-sm'>
            {shown.map((p) => (
              <li key={p.id}>
                <label className='flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50'>
                  <input type='checkbox' checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className='text-slate-800'>{p.name}</span>
                  <span className='text-xs text-slate-500'>{p.department}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className='px-3 py-2 text-slate-500'>Nobody matches.</li>}
          </ul>
        </div>

        {assign.error && <p className='text-sm text-red-600'>{apiErrorMessage(assign.error)}</p>}
        <div className='flex justify-end gap-2'>
          <button type='button' onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button
            type='submit'
            disabled={assign.isPending || picked.size === 0 || !stream || title.trim().length < 3}
            className={primaryBtn}
          >
            {assign.isPending ? 'Assigning…' : `Assign to ${picked.size}`}
          </button>
        </div>
      </form>
    </Shell>
  );
};

/** Mark my training done: an optional note and an optional certificate (PDF / image). */
export const CompleteTrainingModal = ({
  training,
  onClose,
}: {
  training: Training;
  onClose: () => void;
}) => {
  const invalidate = useTrainingsInvalidate();
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const done = useMutation({
    mutationFn: async () => {
      // The proof first: a bad file is refused before anything is marked done.
      if (file) await trainingsApi.uploadCertificate(training.id, file);
      return trainingsApi.complete(training.id, note.trim() || undefined);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: invalidate,
  });
  return (
    <Shell title={`Done: ${training.title}`} onClose={onClose}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          done.mutate();
        }}
        className='space-y-4'
      >
        <label className='block space-y-1'>
          <span className={labelClass}>A note for {training.assignedBy.name} (optional)</span>
          <textarea
            className={inputClass}
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='What you took away, where the certificate is…'
          />
        </label>
        <label className='block space-y-1'>
          <span className={labelClass}>Certificate (optional — PDF, JPG or PNG, up to 10 MB)</span>
          <input
            type='file'
            accept='.pdf,.jpg,.jpeg,.png'
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className='text-sm'
          />
        </label>
        {done.error && <p className='text-sm text-red-600'>{apiErrorMessage(done.error)}</p>}
        <div className='flex justify-end gap-2'>
          <button type='button' onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button type='submit' disabled={done.isPending} className={primaryBtn}>
            {done.isPending ? 'Saving…' : 'Mark as done'}
          </button>
        </div>
      </form>
    </Shell>
  );
};

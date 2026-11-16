import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { Training } from '@app-types/api.types';
import { STREAM_LABEL, trainingsApi } from '@services/api/trainings.api';
import { apiErrorMessage } from '@utils/apiError';

import { CompleteTrainingModal } from './TrainingModals.component';
import { useTrainingsInvalidate } from './useTrainingsInvalidate';

type Filter = 'open' | 'done' | 'all';

const fmt = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const StatusChip = ({ t }: { t: Training }) => {
  const [text, cls] =
    t.status === 'completed'
      ? ['✓ Done', 'bg-emerald-50 text-emerald-700']
      : t.status === 'cancelled'
        ? ['Withdrawn', 'bg-slate-100 text-slate-500']
        : t.overdue
          ? ['⚠ Overdue', 'bg-red-50 text-red-700']
          : ['Open', 'bg-sky-50 text-sky-700'];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
};

/**
 * A list of trainings. `mine` = the person's own (mark done, attach a
 * certificate); `manage` = someone else's (reopen / withdraw — the backend
 * decides who may). Open first; a filter switches to done or everything.
 */
const TrainingList = ({
  trainings,
  mode,
  showPerson = false,
  empty,
}: {
  trainings: Training[];
  mode: 'mine' | 'manage';
  showPerson?: boolean;
  empty: string;
}) => {
  const invalidate = useTrainingsInvalidate();
  const [filter, setFilter] = useState<Filter>('open');
  const [completing, setCompleting] = useState<Training | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'reopen' | 'cancel' }) =>
      action === 'reopen' ? trainingsApi.reopen(id) : trainingsApi.cancel(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const attach = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      trainingsApi.uploadCertificate(id, file),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const open = (id: string) =>
    trainingsApi.openCertificate(id).catch((e) => setError(apiErrorMessage(e)));

  const counts = {
    open: trainings.filter((t) => t.status === 'assigned').length,
    done: trainings.filter((t) => t.status === 'completed').length,
  };
  const shown = trainings.filter((t) =>
    filter === 'open'
      ? t.status === 'assigned'
      : filter === 'done'
        ? t.status === 'completed'
        : true,
  );

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap gap-2 text-sm'>
        {(
          [
            ['open', `Open (${counts.open})`],
            ['done', `Done (${counts.done})`],
            ['all', 'All'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type='button'
            onClick={() => setFilter(k)}
            className={`rounded-md px-2.5 py-1 ${
              filter === k
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className='text-sm text-red-600'>{error}</p>}
      {shown.length === 0 ? (
        <p className='text-sm text-slate-500'>{filter === 'open' ? empty : 'Nothing here.'}</p>
      ) : (
        <ul className='divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white'>
          {shown.map((t) => (
            <li key={t.id} className='space-y-1 px-4 py-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium text-slate-800'>{t.title}</span>
                <StatusChip t={t} />
                <span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>
                  {STREAM_LABEL[t.stream]}
                </span>
                {showPerson && (
                  <span className='text-sm text-slate-600'>
                    · {t.employee.name}
                    {t.employee.department && (
                      <span className='text-xs text-slate-400'> ({t.employee.department})</span>
                    )}
                  </span>
                )}
              </div>
              {t.description && <p className='text-sm text-slate-600'>{t.description}</p>}
              <p className='text-xs text-slate-500'>
                From {t.assignedBy.name} on {fmt(t.assignedAt)}
                {t.dueOn && ` · due ${fmt(t.dueOn)}`}
                {t.completedAt && ` · done ${fmt(t.completedAt)}`}
                {t.cancelledAt && ` · withdrawn ${fmt(t.cancelledAt)}`}
              </p>
              {t.completionNote && (
                <p className='text-sm italic text-slate-600'>“{t.completionNote}”</p>
              )}
              <div className='flex flex-wrap items-center gap-3 pt-1 text-xs'>
                {t.link && (
                  <a
                    href={t.link}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-brand-600 hover:underline'
                  >
                    Open the course
                  </a>
                )}
                {t.certificate && (
                  <button
                    type='button'
                    onClick={() => open(t.id)}
                    className='text-brand-600 hover:underline'
                  >
                    Certificate ({t.certificate.fileName})
                  </button>
                )}
                {mode === 'mine' && t.status === 'assigned' && (
                  <button
                    type='button'
                    onClick={() => setCompleting(t)}
                    className='rounded-md bg-brand-600 px-2.5 py-1 font-medium text-white hover:bg-brand-500'
                  >
                    Mark as done
                  </button>
                )}
                {mode === 'mine' && t.status === 'completed' && !t.certificate && (
                  <label className='cursor-pointer text-brand-600 hover:underline'>
                    Attach a certificate
                    <input
                      type='file'
                      accept='.pdf,.jpg,.jpeg,.png'
                      className='hidden'
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) attach.mutate({ id: t.id, file });
                      }}
                    />
                  </label>
                )}
                {mode === 'manage' && t.status === 'completed' && (
                  <button
                    type='button'
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: t.id, action: 'reopen' })}
                    className='text-slate-600 hover:underline'
                  >
                    Reopen
                  </button>
                )}
                {mode === 'manage' && t.status === 'assigned' && (
                  <button
                    type='button'
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: t.id, action: 'cancel' })}
                    className='text-red-600 hover:underline'
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {completing && (
        <CompleteTrainingModal training={completing} onClose={() => setCompleting(null)} />
      )}
    </div>
  );
};

export default TrainingList;

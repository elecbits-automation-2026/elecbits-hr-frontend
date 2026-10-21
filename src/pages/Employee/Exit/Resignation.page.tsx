import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ExitInterview, MyExitPage } from '@app-types/api.types';
import ExitCard from '@components/Common/Exits/ExitCard.component';
import { INTERVIEW_TEXT, isoToday, longDay } from '@constants/Common/exits.constants';
import { exitsApi } from '@services/api/exits.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const primary =
  'rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40';
const card = 'space-y-4 rounded-xl border border-slate-200 bg-white p-5';

const ResignForm = ({ page, onDone }: { page: MyExitPage; onDone: () => void }) => {
  const [reason, setReason] = useState('');
  const [lastDay, setLastDay] = useState(page.defaultLastDay);
  const [sure, setSure] = useState(false);
  const resign = useMutation({
    mutationFn: () =>
      exitsApi.resign({
        reason: reason.trim(),
        ...(lastDay !== page.defaultLastDay ? { lastWorkingDay: lastDay } : {}),
      }),
    onSuccess: onDone,
  });
  return (
    <div className={card}>
      <h2 className='text-sm font-semibold text-slate-700'>Resign</h2>
      <p className='text-sm text-slate-500'>
        Your notice period is <b>{page.noticeDays} days</b>, so your last working day would be{' '}
        <b>{longDay(page.defaultLastDay)}</b>. You can propose another date; HR fixes the final one,
        and a shorter notice may be recovered from your full & final.
      </p>
      <label className='block space-y-1'>
        <span className='text-xs text-slate-500'>Why are you leaving?</span>
        <textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={input}
        />
      </label>
      <label className='block space-y-1'>
        <span className='text-xs text-slate-500'>Proposed last working day</span>
        <input
          type='date'
          min={isoToday()}
          value={lastDay}
          onChange={(e) => setLastDay(e.target.value)}
          className={`${input} max-w-xs`}
        />
      </label>
      <div className='rounded-lg bg-slate-50 p-3 text-xs text-slate-600'>
        During notice only sick leave can be taken (3 or more days in a row need a medical
        certificate), and every earned-leave day is paid out in your full & final instead. You can
        withdraw until HR accepts.
      </div>
      <label className='flex items-center gap-2 text-sm text-slate-700'>
        <input type='checkbox' checked={sure} onChange={(e) => setSure(e.target.checked)} />I want
        to resign
      </label>
      {resign.error && <p className='text-sm text-red-600'>{apiErrorMessage(resign.error)}</p>}
      <div className='flex justify-end'>
        <button
          type='button'
          disabled={!sure || reason.trim().length < 10 || resign.isPending}
          onClick={() => resign.mutate()}
          className={primary}
        >
          Submit resignation
        </button>
      </div>
    </div>
  );
};

const Rating = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <div className='flex gap-1'>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type='button'
        onClick={() => onChange(n)}
        className={`h-8 w-8 rounded-md border text-sm ${
          value === n
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {n}
      </button>
    ))}
  </div>
);

const YesNo = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) => (
  <div className='flex gap-4 text-sm text-slate-700'>
    {[true, false].map((v) => (
      <label key={String(v)} className='flex items-center gap-1.5'>
        <input type='radio' checked={value === v} onChange={() => onChange(v)} />
        {v ? 'Yes' : 'No'}
      </label>
    ))}
  </div>
);

/** The exit interview — only on the last working day. HR sees it, your manager doesn't. */
const InterviewForm = ({
  exitId,
  reasons,
  onDone,
}: {
  exitId: string;
  reasons: string[];
  onDone: () => void;
}) => {
  const [a, setA] = useState<{
    reason: string;
    liked: string;
    improve: string;
    managerRating: number;
    roleRating: number;
    recommend: boolean | null;
    wouldReturn: boolean | null;
    newWorkplace: string;
    other: string;
  }>({
    reason: '',
    liked: '',
    improve: '',
    managerRating: 0,
    roleRating: 0,
    recommend: null,
    wouldReturn: null,
    newWorkplace: '',
    other: '',
  });
  const send = useMutation({
    mutationFn: () => {
      const answers: ExitInterview = {
        reason: a.reason,
        liked: a.liked.trim(),
        improve: a.improve.trim(),
        managerRating: a.managerRating,
        roleRating: a.roleRating,
        recommend: a.recommend!,
        wouldReturn: a.wouldReturn!,
        ...(a.newWorkplace.trim() ? { newWorkplace: a.newWorkplace.trim() } : {}),
        ...(a.other.trim() ? { other: a.other.trim() } : {}),
      };
      return exitsApi.interview(exitId, answers);
    },
    onSuccess: onDone,
  });
  const valid =
    !!a.reason &&
    a.managerRating > 0 &&
    a.roleRating > 0 &&
    a.recommend !== null &&
    a.wouldReturn !== null;
  const q = (k: keyof typeof INTERVIEW_TEXT, body: React.ReactNode) => (
    <div className='space-y-1'>
      <p className='text-sm text-slate-700'>{INTERVIEW_TEXT[k]}</p>
      {body}
    </div>
  );
  return (
    <div className={card}>
      <div>
        <h2 className='text-sm font-semibold text-slate-700'>Exit interview</h2>
        <p className='text-xs text-slate-500'>
          Today is your last working day. Your answers go to HR only — not to your manager.
        </p>
      </div>
      {q(
        'reason',
        <select
          value={a.reason}
          onChange={(e) => setA({ ...a, reason: e.target.value })}
          className={input}
        >
          <option value=''>Choose…</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>,
      )}
      {q(
        'liked',
        <textarea
          rows={2}
          value={a.liked}
          onChange={(e) => setA({ ...a, liked: e.target.value })}
          className={input}
        />,
      )}
      {q(
        'improve',
        <textarea
          rows={2}
          value={a.improve}
          onChange={(e) => setA({ ...a, improve: e.target.value })}
          className={input}
        />,
      )}
      {q(
        'managerRating',
        <Rating value={a.managerRating} onChange={(n) => setA({ ...a, managerRating: n })} />,
      )}
      {q(
        'roleRating',
        <Rating value={a.roleRating} onChange={(n) => setA({ ...a, roleRating: n })} />,
      )}
      {q('recommend', <YesNo value={a.recommend} onChange={(v) => setA({ ...a, recommend: v })} />)}
      {q(
        'wouldReturn',
        <YesNo value={a.wouldReturn} onChange={(v) => setA({ ...a, wouldReturn: v })} />,
      )}
      {q(
        'newWorkplace',
        <input
          value={a.newWorkplace}
          onChange={(e) => setA({ ...a, newWorkplace: e.target.value })}
          className={input}
        />,
      )}
      {q(
        'other',
        <textarea
          rows={2}
          value={a.other}
          onChange={(e) => setA({ ...a, other: e.target.value })}
          className={input}
        />,
      )}
      {send.error && <p className='text-sm text-red-600'>{apiErrorMessage(send.error)}</p>}
      <div className='flex justify-end'>
        <button
          type='button'
          disabled={!valid || send.isPending}
          onClick={() => send.mutate()}
          className={primary}
        >
          Send to HR
        </button>
      </div>
    </div>
  );
};

/**
 * Resignation: resign (with a reason and a proposed last day), follow the
 * exit — HR's acceptance, the four clearances — fill the exit interview on
 * the last day, and get the letters once the full & final is settled.
 */
const ResignationPage = () => {
  const queryClient = useQueryClient();
  const page = useQuery({ queryKey: ['my-exit'], queryFn: exitsApi.mine });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-exit'] });
    queryClient.invalidateQueries({ queryKey: ['me'] });
  };
  const exit = page.data?.exit ?? null;
  const live = exit && ['submitted', 'accepted', 'relieved', 'settled'].includes(exit.status);

  return (
    <div className='w-full max-w-3xl space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Resignation</h1>
        <p className='text-sm text-slate-500'>
          Your exit, step by step: HR accepts and fixes your last day, then HR, your manager, OPS
          and payroll each clear you. Your full & final is paid with the next monthly payroll.
        </p>
      </div>
      {page.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
      {page.error && <p className='text-sm text-red-600'>{apiErrorMessage(page.error)}</p>}
      {page.data && !live && (
        <>
          {exit && (
            <p className='rounded-lg bg-slate-50 p-3 text-sm text-slate-600'>
              Your earlier resignation was {exit.status}.
            </p>
          )}
          <ResignForm page={page.data} onDone={refresh} />
        </>
      )}
      {page.data && exit && live && exit.can.interview && (
        <InterviewForm exitId={exit.id} reasons={page.data.interviewReasons} onDone={refresh} />
      )}
      {page.data && exit && live && (
        <div className={card}>
          <ExitCard exit={exit} onChanged={refresh} showPerson={false} />
        </div>
      )}
    </div>
  );
};

export default ResignationPage;

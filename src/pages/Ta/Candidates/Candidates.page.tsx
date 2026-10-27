import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Candidate } from '@app-types/api.types';
import AddCandidateDialog from '@components/Ta/Hiring/AddCandidateDialog.component';
import ApplicationRow from '@components/Ta/Hiring/ApplicationRow.component';
import { SOURCE_LABEL } from '@constants/Common/hiring.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { hiringApi } from '@services/api/hiring.api';
import { apiErrorMessage } from '@utils/apiError';

const btn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50';

/** One candidate: contact, CV, every application with its scores, and "consider for". */
const CandidateDetail = ({ c }: { c: Candidate }) => {
  const queryClient = useQueryClient();
  const open = useQuery({
    queryKey: ['hiring-requisitions', 'approved'],
    queryFn: () => hiringApi.list('approved'),
  });
  const [positionId, setPositionId] = useState('');
  const apply = useMutation({
    mutationFn: () => candidatesApi.apply(positionId, c.id),
    onSuccess: () => {
      setPositionId('');
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
  const cv = useMutation({ mutationFn: () => candidatesApi.openCv(c.id) });
  const upload = useMutation({
    mutationFn: (file: File) => candidatesApi.uploadCv(c.id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidates'] }),
  });
  const choices = (open.data ?? []).flatMap((r) =>
    r.positions
      .filter((p) => p.status === 'open' || p.status === 'interviewing')
      .filter((p) => !c.applications.some((a) => a.positionId === p.id))
      .map((p) => ({ id: p.id, label: `${r.roleTitle} #${p.number} · ${r.departmentName}` })),
  );

  return (
    <div className='space-y-3 border-t border-slate-100 pt-3'>
      <div className='flex flex-wrap gap-2 text-xs text-slate-500'>
        {c.email && <span>{c.email}</span>}
        {c.phone && <span>{c.phone}</span>}
        <span>Source: {SOURCE_LABEL[c.source]}</span>
        {c.referredByName && <span>Referred by {c.referredByName}</span>}
        <span>Kept until {c.retainUntil}</span>
      </div>
      {c.notes && <p className='whitespace-pre-wrap text-sm text-slate-600'>{c.notes}</p>}
      {!c.anonymised && (
        <div className='flex flex-wrap items-center gap-2'>
          {c.hasCv && (
            <button type='button' onClick={() => cv.mutate()} className={btn}>
              Open CV
            </button>
          )}
          <label className={`${btn} cursor-pointer`}>
            {c.hasCv ? 'Replace CV' : 'Upload CV'}
            <input
              type='file'
              accept='.pdf,.doc,.docx'
              className='hidden'
              onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
            />
          </label>
          {(cv.error || upload.error) && (
            <span className='text-xs text-red-600'>
              {apiErrorMessage(cv.error ?? upload.error)}
            </span>
          )}
        </div>
      )}
      {c.applications.map((a) => (
        <ApplicationRow key={a.id} app={a} showRole />
      ))}
      {!c.anonymised && choices.length > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          <select
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className='rounded-md border border-slate-300 px-2 py-1.5 text-sm'
          >
            <option value=''>Consider for an open position…</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type='button'
            disabled={!positionId || apply.isPending}
            onClick={() => apply.mutate()}
            className={btn}
          >
            Add
          </button>
          {apply.error && (
            <span className='text-xs text-red-600'>{apiErrorMessage(apply.error)}</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * The talent pool (TA Step D): everyone TA has considered, kept 6 months
 * after their last consideration. Search, add someone new (duplicates are
 * caught), open a person to see every application and reuse them.
 */
const CandidatesPage = () => {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ['candidates', q],
    queryFn: () => candidatesApi.list(q.trim() || undefined),
  });

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Candidates</h1>
          <p className='text-sm text-slate-500'>
            The talent pool — kept 6 months after each person was last considered.
          </p>
        </div>
        <div className='flex gap-2'>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search name, email, phone'
            className='rounded-md border border-slate-300 px-3 py-1.5 text-sm'
          />
          <button
            type='button'
            onClick={() => setAdding(true)}
            className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700'
          >
            Add a candidate
          </button>
        </div>
      </div>
      {list.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {list.error && <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>}
      {list.data?.length === 0 && (
        <p className='rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>
          Nobody here yet.
        </p>
      )}
      <div className='space-y-2'>
        {list.data?.map((c) => (
          <div key={c.id} className='rounded-xl border border-slate-200 bg-white p-4'>
            <button
              type='button'
              onClick={() => setOpenId(openId === c.id ? null : c.id)}
              className='flex w-full flex-wrap items-center justify-between gap-2 text-left'
            >
              <span className='font-medium text-slate-800'>
                {c.anonymised ? 'Anonymised candidate' : c.name}
              </span>
              <span className='text-xs text-slate-400'>
                {SOURCE_LABEL[c.source]} · {c.applications.length} application(s)
              </span>
            </button>
            {openId === c.id && <CandidateDetail c={c} />}
          </div>
        ))}
      </div>
      {adding && (
        <AddCandidateDialog
          onDone={(id) => {
            setAdding(false);
            setOpenId(id);
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
};

export default CandidatesPage;

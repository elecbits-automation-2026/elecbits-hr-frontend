import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  InterviewRound,
  JdContent,
  Requisition,
  ScorecardContent,
  TaDocument,
} from '@app-types/api.types';
import TaDocumentPanel from '@components/Common/Hiring/TaDocumentPanel.component';
import {
  InterviewerList,
  PositionPipeline,
} from '@components/Ta/Hiring/PositionPipeline.component';
import {
  POSITION_STATUS_LABEL,
  ROUND_LABEL,
  budgetText,
} from '@constants/Common/hiring.constants';
import { hiringApi } from '@services/api/hiring.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const btn =
  'rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50';
const primary =
  'rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50';

const KEYS = [['hiring-requisitions']];
const editable = (d: TaDocument | null) => !d || d.status === 'draft' || d.status === 'returned';

/** Positions of the line: who works each, and (for the line's TA RM) Assign. */
const Positions = ({ req, isTaRm }: { req: Requisition; isTaRm: boolean }) => {
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ['me-team'], queryFn: meApi.team, enabled: isTaRm });
  const [picking, setPicking] = useState<string | null>(null);
  const [recruiterId, setRecruiterId] = useState('');
  const [weight, setWeight] = useState(10);
  const assign = useMutation({
    mutationFn: (positionId: string) =>
      hiringApi.assignPosition(positionId, { recruiterId, weight }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
      setPicking(null);
    },
  });
  const reports = (team.data ?? []).filter((m) => m.relation === 'report' && m.status === 'active');

  return (
    <div className='space-y-2'>
      <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>Positions</p>
      {req.positions.map((p) => (
        <div key={p.id} className='rounded-lg border border-slate-200 bg-white p-3 text-sm'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className='text-slate-800'>
              #{p.number} · {POSITION_STATUS_LABEL[p.status]}
            </span>
            <span className='text-xs text-slate-500'>
              {p.recruiterName
                ? `${p.recruiterName} · goal weight ${p.goal?.weight ?? '–'} · ${p.goal?.progress ?? 0}%`
                : 'No recruiter yet'}
            </span>
          </div>
          {isTaRm &&
            (p.status === 'awaiting_docs' ||
              p.status === 'open' ||
              p.status === 'interviewing') && (
              <>
                {picking === p.id ? (
                  <div className='mt-2 space-y-2'>
                    <div className='grid grid-cols-[1fr_110px] gap-2'>
                      <select
                        value={recruiterId}
                        onChange={(e) => setRecruiterId(e.target.value)}
                        className={input}
                      >
                        <option value=''>Recruiter (your team)…</option>
                        {reports.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type='number'
                        min={1}
                        max={100}
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value))}
                        className={input}
                        aria-label='Goal weight'
                        title='Weight of this hiring goal among their goals'
                      />
                    </div>
                    {assign.error && (
                      <p className='text-xs text-red-600'>{apiErrorMessage(assign.error)}</p>
                    )}
                    <div className='flex justify-end gap-2'>
                      <button type='button' onClick={() => setPicking(null)} className={btn}>
                        Cancel
                      </button>
                      <button
                        type='button'
                        disabled={!recruiterId || weight < 1 || assign.isPending}
                        onClick={() => assign.mutate(p.id)}
                        className={primary}
                      >
                        {p.recruiterId ? 'Reassign' : 'Assign'} (creates their goal)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className='mt-2 flex justify-end'>
                    <button
                      type='button'
                      onClick={() => {
                        assign.reset();
                        setRecruiterId('');
                        setPicking(p.id);
                      }}
                      className={btn}
                    >
                      {p.recruiterId ? 'Reassign' : 'Assign a recruiter'}
                    </button>
                  </div>
                )}
              </>
            )}
          {(p.status === 'open' || p.status === 'interviewing') && (
            <div className='mt-3 border-t border-slate-100 pt-3'>
              <PositionPipeline position={p} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const BLANK_JD: JdContent = {
  summary: '',
  responsibilities: '',
  requirements: '',
  location: '',
  employmentType: 'Full-time',
  ctcRange: '',
};

const JdEditor = ({ req, onDone }: { req: Requisition; onDone: () => void }) => {
  const queryClient = useQueryClient();
  const start = (req.documents.jd?.content as unknown as JdContent | undefined) ?? {
    ...BLANK_JD,
    summary: req.notes ?? '',
    ctcRange: budgetText(req.budgetMin, req.budgetMax) ?? '',
  };
  const [jd, setJd] = useState<JdContent>(start);
  const save = useMutation({
    mutationFn: () =>
      hiringApi.saveDocument(req.id, 'jd', { ...jd, ctcRange: jd.ctcRange?.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
      onDone();
    },
  });
  const field = (k: keyof JdContent, label: string, rows = 0) => (
    <label className='block space-y-1'>
      <span className='text-xs text-slate-500'>{label}</span>
      {rows ? (
        <textarea
          rows={rows}
          value={jd[k] ?? ''}
          onChange={(e) => setJd({ ...jd, [k]: e.target.value })}
          className={input}
        />
      ) : (
        <input
          value={jd[k] ?? ''}
          onChange={(e) => setJd({ ...jd, [k]: e.target.value })}
          className={input}
        />
      )}
    </label>
  );
  const valid = ['summary', 'responsibilities', 'requirements', 'location', 'employmentType'].every(
    (k) => String(jd[k as keyof JdContent] ?? '').trim(),
  );
  return (
    <div className='space-y-2 rounded-lg border border-slate-200 bg-white p-3'>
      <p className='text-sm font-medium text-slate-800'>Job description</p>
      {field('summary', 'Summary', 3)}
      {field('responsibilities', 'Responsibilities', 4)}
      {field('requirements', 'Requirements', 4)}
      <div className='grid grid-cols-3 gap-2'>
        {field('location', 'Location')}
        {field('employmentType', 'Employment type')}
        {field('ctcRange', 'CTC range (optional)')}
      </div>
      {save.error && <p className='text-xs text-red-600'>{apiErrorMessage(save.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button type='button' onClick={onDone} className={btn}>
          Cancel
        </button>
        <button
          type='button'
          disabled={!valid || save.isPending}
          onClick={() => save.mutate()}
          className={primary}
        >
          Save draft
        </button>
      </div>
    </div>
  );
};

const ScorecardEditor = ({ req, onDone }: { req: Requisition; onDone: () => void }) => {
  const queryClient = useQueryClient();
  const rounds = req.rounds.map((r) => r.round);
  const existing = req.documents.scorecard?.content as unknown as ScorecardContent | undefined;
  const [rows, setRows] = useState<ScorecardContent['criteria']>(
    existing?.criteria ?? rounds.map((round) => ({ round, criterion: '', guidance: '' })),
  );
  const save = useMutation({
    mutationFn: () =>
      hiringApi.saveDocument(req.id, 'scorecard', {
        criteria: rows
          .filter((r) => r.criterion.trim())
          .map((r) => ({
            round: r.round,
            criterion: r.criterion.trim(),
            guidance: r.guidance?.trim() || null,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
      onDone();
    },
  });
  const set = (i: number, patch: Partial<ScorecardContent['criteria'][number]>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className='space-y-2 rounded-lg border border-slate-200 bg-white p-3'>
      <p className='text-sm font-medium text-slate-800'>Scorecard</p>
      <p className='text-xs text-slate-500'>
        What each round rates. Every criterion is scored 1–5 by that round&apos;s interviewer.
      </p>
      {rows.map((r, i) => (
        <div key={i} className='grid grid-cols-[150px_1fr_1fr_auto] items-start gap-2'>
          <select
            value={r.round}
            onChange={(e) => set(i, { round: e.target.value as InterviewRound })}
            className={input}
          >
            {rounds.map((x) => (
              <option key={x} value={x}>
                {ROUND_LABEL[x]}
              </option>
            ))}
          </select>
          <input
            value={r.criterion}
            onChange={(e) => set(i, { criterion: e.target.value })}
            placeholder='Criterion, e.g. Circuit design'
            className={input}
          />
          <input
            value={r.guidance ?? ''}
            onChange={(e) => set(i, { guidance: e.target.value })}
            placeholder='Guidance (optional)'
            className={input}
          />
          <button
            type='button'
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            className='px-2 py-2 text-slate-400 hover:text-red-600'
            aria-label='Remove criterion'
          >
            ×
          </button>
        </div>
      ))}
      <button
        type='button'
        onClick={() => setRows([...rows, { round: rounds[0]!, criterion: '', guidance: '' }])}
        className={btn}
      >
        Add criterion
      </button>
      {save.error && <p className='text-xs text-red-600'>{apiErrorMessage(save.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button type='button' onClick={onDone} className={btn}>
          Cancel
        </button>
        <button
          type='button'
          disabled={!rows.some((r) => r.criterion.trim()) || save.isPending}
          onClick={() => save.mutate()}
          className={primary}
        >
          Save draft
        </button>
      </div>
    </div>
  );
};

/**
 * TA's workspace for one approved line (Step C): positions → recruiters
 * (the line's TA RM only, once Admin gives it to them), and the line's JD +
 * scorecard — write, send for review, fix what comes back. Positions open
 * once both are approved.
 */
const LineWorkspace = ({ req }: { req: Requisition }) => {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isTaRm = !!me.data && req.taRm?.id === me.data.id;
  const [editing, setEditing] = useState<'jd' | 'scorecard' | null>(null);
  const submit = useMutation({
    mutationFn: (kind: 'jd' | 'scorecard') => hiringApi.submitDocument(req.id, kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] }),
  });

  const docBlock = (kind: 'jd' | 'scorecard') => {
    const doc = req.documents[kind];
    const label = kind === 'jd' ? 'JD' : 'scorecard';
    if (editing === kind) {
      return kind === 'jd' ? (
        <JdEditor req={req} onDone={() => setEditing(null)} />
      ) : (
        <ScorecardEditor req={req} onDone={() => setEditing(null)} />
      );
    }
    return (
      <div className='space-y-2'>
        {doc ? (
          <TaDocumentPanel doc={doc} invalidate={KEYS} />
        ) : (
          <p className='rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500'>
            No {label} yet.
          </p>
        )}
        {editable(doc) && (
          <div className='flex justify-end gap-2'>
            <button
              type='button'
              onClick={() => {
                submit.reset();
                setEditing(kind);
              }}
              className={btn}
            >
              {doc ? `Edit ${label}` : `Write the ${label}`}
            </button>
            {doc && (
              <button
                type='button'
                disabled={submit.isPending}
                onClick={() => submit.mutate(kind)}
                className={primary}
              >
                Send for review
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className='w-full space-y-4 border-t border-slate-100 pt-3'>
      <p className='text-sm text-slate-600'>
        {req.taRm ? (
          <>
            TA RM: <span className='font-medium text-slate-800'>{req.taRm.name}</span>
            {isTaRm && ' (you) — assign each position to someone in your team.'}
          </>
        ) : (
          'Waiting for Admin to give this line to a TA RM.'
        )}
      </p>
      <Positions req={req} isTaRm={isTaRm} />
      <InterviewerList req={req} />
      {submit.error && <p className='text-sm text-red-600'>{apiErrorMessage(submit.error)}</p>}
      <div className='grid gap-3 lg:grid-cols-2'>
        {docBlock('jd')}
        {docBlock('scorecard')}
      </div>
    </div>
  );
};

export default LineWorkspace;

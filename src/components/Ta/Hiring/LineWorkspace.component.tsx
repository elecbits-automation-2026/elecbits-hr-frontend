import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CandidateSource,
  InterviewRound,
  JdContent,
  Position,
  Requisition,
  ScorecardContent,
  TaDocument,
} from '@app-types/api.types';
import JdDocument from '@components/Common/Hiring/JdDocument.component';
import TaDocumentPanel from '@components/Common/Hiring/TaDocumentPanel.component';
import {
  InterviewerList,
  PositionPipeline,
} from '@components/Ta/Hiring/PositionPipeline.component';
import {
  longDate,
  POSITION_STATUS_LABEL,
  PRIORITY_LABEL,
  ROUND_LABEL,
  SOURCE_LABEL,
} from '@constants/Common/hiring.constants';
import { JD_JOB_TYPES } from '@constants/Common/jdTemplate.constants';
import {
  SCREENING_TEMPLATE,
  defaultRoundWeights,
} from '@constants/Common/scorecardTemplate.constants';
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

/** Where the position is being sourced: channels activated, by whom, when (workflow deck step 6). */
const PositionSources = ({ position, canAdd }: { position: Position; canAdd: boolean }) => {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [channel, setChannel] = useState<CandidateSource>('naukri');
  const [on, setOn] = useState(new Date().toLocaleDateString('en-CA'));
  const [notes, setNotes] = useState('');
  const add = useMutation({
    mutationFn: () =>
      hiringApi.addSource(position.id, { channel, activatedOn: on, notes: notes.trim() || undefined }),
    onSuccess: () => {
      setAdding(false);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
    },
  });
  return (
    <div className='mt-3 space-y-1.5 border-t border-slate-100 pt-3'>
      <div className='flex items-center justify-between'>
        <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>Sources</p>
        {canAdd && !adding && (
          <button type='button' onClick={() => setAdding(true)} className={btn}>
            Log a source
          </button>
        )}
      </div>
      {position.sources.length === 0 && !adding && (
        <p className='text-xs text-slate-400'>No sourcing channel logged yet.</p>
      )}
      <div className='flex flex-wrap gap-1.5'>
        {position.sources.map((s) => (
          <span key={s.id} title={s.notes ?? undefined} className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>
            {SOURCE_LABEL[s.channel]} · {longDate(s.activatedOn)} · {s.spocName}
          </span>
        ))}
      </div>
      {adding && (
        <div className='grid gap-2 sm:grid-cols-[150px_150px_1fr_auto]'>
          <select value={channel} onChange={(e) => setChannel(e.target.value as CandidateSource)} className={input}>
            {(Object.keys(SOURCE_LABEL) as CandidateSource[]).map((c) => (
              <option key={c} value={c}>
                {SOURCE_LABEL[c]}
              </option>
            ))}
          </select>
          <input type='date' value={on} onChange={(e) => setOn(e.target.value)} className={input} aria-label='Activated on' />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='Notes, e.g. job posted' className={input} />
          <span className='flex gap-1'>
            <button type='button' onClick={() => setAdding(false)} className={btn}>
              Cancel
            </button>
            <button type='button' disabled={!on || add.isPending} onClick={() => add.mutate()} className={primary}>
              Save
            </button>
          </span>
          {add.error && <p className='text-xs text-red-600 sm:col-span-4'>{apiErrorMessage(add.error)}</p>}
        </div>
      )}
    </div>
  );
};

/** Positions of the line: who works each, and (for the line's TA RM) Assign. */
const Positions = ({
  req,
  isTaRm,
  meId,
}: {
  req: Requisition;
  isTaRm: boolean;
  meId: string | undefined;
}) => {
  const queryClient = useQueryClient();
  // Only reports in the TA batch: the JD, scorecard and candidates sit behind it.
  const team = useQuery({
    queryKey: ['hiring-recruiters'],
    queryFn: hiringApi.recruiters,
    enabled: isTaRm,
  });
  const [picking, setPicking] = useState<string | null>(null);
  const [recruiterId, setRecruiterId] = useState('');
  const [weight, setWeight] = useState(10);
  const [closeOn, setCloseOn] = useState('');
  const assign = useMutation({
    mutationFn: (positionId: string) =>
      hiringApi.assignPosition(positionId, {
        recruiterId,
        weight,
        expectedCloseOn: closeOn || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
      setPicking(null);
    },
  });
  const reports = team.data ?? [];

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
                        <option value=''>Recruiter (your TA team)…</option>
                        {meId && <option value={meId}>Me — I&apos;ll recruit it myself</option>}
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
                    <label className='flex items-center gap-2 text-xs text-slate-500'>
                      Expected closure
                      <input
                        type='date'
                        value={closeOn}
                        onChange={(e) => setCloseOn(e.target.value)}
                        className='rounded-md border border-slate-300 px-2 py-1 text-sm'
                      />
                    </label>
                    {team.isSuccess && reports.length === 0 && recruiterId !== meId && (
                      <p className='text-xs text-amber-700'>
                        None of your reports is in the TA batch — keep it yourself, or Admin
                        adds them in Access batches.
                      </p>
                    )}
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
          {(p.priority !== 'normal' || p.expectedCloseOn) && (
            <p className='mt-1 text-xs text-slate-500'>
              {PRIORITY_LABEL[p.priority].label}
              {p.expectedCloseOn && <> · expected closure {longDate(p.expectedCloseOn)}</>}
            </p>
          )}
          {p.recruiterId && (
            <div className='mt-3 border-t border-slate-100 pt-3'>
              <PositionDocuments req={req} position={p} isRecruiter={p.recruiterId === meId} />
            </div>
          )}
          {p.recruiterId && (
            <PositionSources position={p} canAdd={p.recruiterId === meId || isTaRm} />
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

type EditorProps = { req: Requisition; position: Position; onDone: () => void };

/** One bullet per line in a textarea ⇄ the stored list. */
const toLines = (v: string[] | undefined) => (v ?? []).join('\n');
const fromLines = (v: string) =>
  v
    .split('\n')
    .map((x) => x.replace(/^[•\-*●]\s*/, '').trim())
    .filter(Boolean);

type JdDraft = Omit<JdContent, 'responsibilities' | 'requiredSkills' | 'preferredSkills'> & {
  responsibilities: string;
  requiredSkills: string;
  preferredSkills: string;
};

const draftOf = (c: Partial<JdContent>): JdDraft => ({
  jobType: c.jobType ?? 'Full-time',
  city: c.city ?? '',
  ctc: c.ctc ?? '',
  businessUnit: c.businessUnit ?? '',
  roleSummary: c.roleSummary ?? '',
  responsibilities: toLines(c.responsibilities),
  requiredSkills: toLines(c.requiredSkills),
  preferredSkills: toLines(c.preferredSkills),
});

const contentOf = (d: JdDraft): JdContent => ({
  jobType: d.jobType.trim(),
  city: d.city.trim(),
  ctc: d.ctc.trim(),
  businessUnit: d.businessUnit.trim(),
  roleSummary: d.roleSummary.trim(),
  responsibilities: fromLines(d.responsibilities),
  requiredSkills: fromLines(d.requiredSkills),
  preferredSkills: fromLines(d.preferredSkills),
});

/**
 * The JD form, as per the company template: the recruiter fills the
 * role-specific parts; About Elecbits, Why Join Us and the footer are fixed
 * and added on the printed JD. Can start from another position's JD.
 */
const JdEditor = ({ req, position, onDone }: EditorProps) => {
  const queryClient = useQueryClient();
  const saved = position.documents.jd?.content as Partial<JdContent> | undefined;
  const [jd, setJd] = useState<JdDraft>(() =>
    draftOf(
      saved ?? {
        jobType: req.employmentType ?? 'Full-time',
        city: req.location ?? '',
        ctc: 'Negotiable',
        roleSummary: req.notes ?? '',
      },
    ),
  );
  const [preview, setPreview] = useState(false);
  // Other positions of this line that already have a JD to start from.
  const others = req.positions.filter((p) => p.id !== position.id && p.documents.jd);
  const save = useMutation({
    mutationFn: () => hiringApi.saveDocument(position.id, 'jd', contentOf(jd)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
      onDone();
    },
  });
  const set = (k: keyof JdDraft) => (e: { target: { value: string } }) =>
    setJd({ ...jd, [k]: e.target.value });
  const c = contentOf(jd);
  const valid =
    !!c.jobType &&
    !!c.city &&
    !!c.ctc &&
    !!c.businessUnit &&
    !!c.roleSummary &&
    c.responsibilities.length > 0 &&
    c.requiredSkills.length > 0;
  const label = (text: string, hint?: string) => (
    <span className='text-xs text-slate-500'>
      {text}
      {hint && <span className='text-slate-400'> — {hint}</span>}
    </span>
  );

  return (
    <div className='space-y-3 rounded-lg border border-slate-200 bg-white p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-medium text-slate-800'>
          Job description · {req.roleTitle} #{position.number}
        </p>
        {others.length > 0 && (
          <select
            value=''
            onChange={(e) => {
              const from = others.find((p) => p.id === e.target.value);
              if (from?.documents.jd) setJd(draftOf(from.documents.jd.content as Partial<JdContent>));
            }}
            className='rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600'
          >
            <option value=''>Copy from another position…</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} · {p.recruiterName ?? 'no recruiter'}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className='text-xs text-slate-500'>
        About Elecbits, Why Join Us and the office footer are the same on every JD and are added
        automatically.
      </p>
      <div className='grid gap-2 sm:grid-cols-3'>
        <label className='block space-y-1'>
          {label('Job type')}
          <select value={jd.jobType} onChange={set('jobType')} className={input}>
            {JD_JOB_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className='block space-y-1'>
          {label('City', 'hiring location')}
          <input value={jd.city} onChange={set('city')} placeholder='Bengaluru' className={input} />
        </label>
        <label className='block space-y-1'>
          {label('Cost to company')}
          <input value={jd.ctc} onChange={set('ctc')} placeholder='Negotiable' className={input} />
        </label>
      </div>
      <label className='block space-y-1'>
        {label('About the business unit', `what ${req.departmentName} does`)}
        <textarea rows={3} value={jd.businessUnit} onChange={set('businessUnit')} className={input} />
      </label>
      <label className='block space-y-1'>
        {label('Role summary')}
        <textarea rows={3} value={jd.roleSummary} onChange={set('roleSummary')} className={input} />
      </label>
      <label className='block space-y-1'>
        {label('Key responsibilities', 'one per line')}
        <textarea
          rows={5}
          value={jd.responsibilities}
          onChange={set('responsibilities')}
          className={input}
        />
      </label>
      <div className='grid gap-2 sm:grid-cols-2'>
        <label className='block space-y-1'>
          {label('Must-have skills: required', 'one per line')}
          <textarea
            rows={4}
            value={jd.requiredSkills}
            onChange={set('requiredSkills')}
            className={input}
          />
        </label>
        <label className='block space-y-1'>
          {label('Preferred skills', 'optional, one per line')}
          <textarea
            rows={4}
            value={jd.preferredSkills}
            onChange={set('preferredSkills')}
            className={input}
          />
        </label>
      </div>
      {save.error && <p className='text-xs text-red-600'>{apiErrorMessage(save.error)}</p>}
      <div className='flex flex-wrap justify-end gap-2'>
        <button type='button' onClick={() => setPreview(true)} className={btn}>
          Preview
        </button>
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
      {preview && (
        <JdDocument c={c} roleTitle={req.roleTitle} onClose={() => setPreview(false)} />
      )}
    </div>
  );
};

type SheetDraft = { round: InterviewRound; weight: number; attributes: Array<{ name: string; questions: string }> };

const sheetsOf = (rounds: ScorecardContent['rounds']): SheetDraft[] =>
  rounds.map((r) => ({
    round: r.round,
    weight: r.weight,
    attributes: r.attributes.map((a) => ({ name: a.name, questions: a.questions.join('\n') })),
  }));

/**
 * The scorecard form, as per the company's Excel: one sheet per round of the
 * line with its weight (all add up to 100), and the attributes it rates with
 * the questions to ask. Interviewers score each attribute 1–4.
 */
const ScorecardEditor = ({ req, position, onDone }: EditorProps) => {
  const queryClient = useQueryClient();
  const lineRounds = req.rounds.map((r) => r.round);
  const saved = position.documents.scorecard?.content as Partial<ScorecardContent> | undefined;
  const blank = (): SheetDraft[] => {
    const w = defaultRoundWeights(lineRounds.length);
    return lineRounds.map((round, i) => ({
      round,
      weight: w[i]!,
      attributes: [{ name: '', questions: '' }],
    }));
  };
  const [sheets, setSheets] = useState<SheetDraft[]>(() =>
    saved?.rounds?.length ? sheetsOf(saved.rounds) : blank(),
  );
  const others = req.positions.filter((p) => p.id !== position.id && p.documents.scorecard);
  const content = (): ScorecardContent => ({
    rounds: sheets.map((s) => ({
      round: s.round,
      weight: s.weight,
      attributes: s.attributes
        .filter((a) => a.name.trim())
        .map((a) => ({ name: a.name.trim(), questions: fromLines(a.questions) })),
    })),
  });
  const save = useMutation({
    mutationFn: () => hiringApi.saveDocument(position.id, 'scorecard', content()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
      onDone();
    },
  });
  const setSheet = (i: number, patch: Partial<SheetDraft>) =>
    setSheets(sheets.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setAttr = (i: number, k: number, patch: Partial<SheetDraft['attributes'][number]>) =>
    setSheet(i, {
      attributes: sheets[i]!.attributes.map((a, j) => (j === k ? { ...a, ...patch } : a)),
    });
  const total = sheets.reduce((a, s) => a + (Number(s.weight) || 0), 0);
  const valid =
    total === 100 && sheets.every((s) => s.weight >= 1 && s.attributes.some((a) => a.name.trim()));

  return (
    <div className='space-y-3 rounded-lg border border-slate-200 bg-white p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-medium text-slate-800'>
          Scorecard · {req.roleTitle} #{position.number}
        </p>
        {others.length > 0 && (
          <select
            value=''
            onChange={(e) => {
              const from = others.find((p) => p.id === e.target.value);
              const c = from?.documents.scorecard?.content as Partial<ScorecardContent> | undefined;
              if (c?.rounds) setSheets(sheetsOf(c.rounds));
            }}
            className='rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600'
          >
            <option value=''>Copy from another position…</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} · {p.recruiterName ?? 'no recruiter'}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className='text-xs text-slate-500'>
        One sheet per interview round. Each round&apos;s interviewer scores every attribute 1–4
        with evidence; attributes in a round weigh the same. Round weights must add up to 100{' '}
        <span className={total === 100 ? 'text-emerald-700' : 'font-medium text-red-600'}>
          (now {total})
        </span>
        .
      </p>
      {sheets.map((s, i) => (
        <div key={s.round} className='space-y-2 rounded-lg border border-slate-200 p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm font-semibold text-slate-800'>
              {ROUND_LABEL[s.round]}{' '}
              <span className='text-xs font-normal text-slate-400'>
                · {req.rounds.find((r) => r.round === s.round)?.interviewerName ?? 'recruiter'}
              </span>
            </p>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() =>
                  setSheet(i, {
                    attributes: SCREENING_TEMPLATE.map((a) => ({
                      name: a.name,
                      questions: a.questions.join('\n'),
                    })),
                  })
                }
                className={btn}
              >
                Fill from screening template
              </button>
              <label className='flex items-center gap-1 text-xs text-slate-500'>
                Weight
                <input
                  type='number'
                  min={1}
                  max={100}
                  value={s.weight}
                  onChange={(e) => setSheet(i, { weight: Number(e.target.value) })}
                  className='w-16 rounded-md border border-slate-300 px-2 py-1 text-sm'
                />
                %
              </label>
            </div>
          </div>
          {s.attributes.map((a, k) => (
            <div key={k} className='grid gap-2 sm:grid-cols-[220px_1fr_auto]'>
              <input
                value={a.name}
                onChange={(e) => setAttr(i, k, { name: e.target.value })}
                placeholder='Attribute, e.g. Domain Fitment'
                className={input}
              />
              <textarea
                rows={2}
                value={a.questions}
                onChange={(e) => setAttr(i, k, { questions: e.target.value })}
                placeholder='Questions to ask — one per line'
                className={input}
              />
              <button
                type='button'
                onClick={() =>
                  setSheet(i, { attributes: s.attributes.filter((_, j) => j !== k) })
                }
                className='px-2 py-2 text-slate-400 hover:text-red-600'
                aria-label='Remove attribute'
              >
                ×
              </button>
            </div>
          ))}
          <button
            type='button'
            onClick={() =>
              setSheet(i, { attributes: [...s.attributes, { name: '', questions: '' }] })
            }
            className={btn}
          >
            Add attribute
          </button>
        </div>
      ))}
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

/**
 * One position's JD + scorecard. Its recruiter writes them and sends each for
 * review (line TA RM + dept head); everyone else sees them read-only. The
 * position opens once both are approved.
 */
export const PositionDocuments = ({
  req,
  position,
  isRecruiter,
}: {
  req: Requisition;
  position: Position;
  isRecruiter: boolean;
}) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<'jd' | 'scorecard' | null>(null);
  const submit = useMutation({
    mutationFn: (kind: 'jd' | 'scorecard') => hiringApi.submitDocument(position.id, kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] }),
  });

  const docBlock = (kind: 'jd' | 'scorecard') => {
    const doc = position.documents[kind];
    const label = kind === 'jd' ? 'JD' : 'scorecard';
    if (editing === kind) {
      return kind === 'jd' ? (
        <JdEditor req={req} position={position} onDone={() => setEditing(null)} />
      ) : (
        <ScorecardEditor req={req} position={position} onDone={() => setEditing(null)} />
      );
    }
    return (
      <div className='space-y-2'>
        {doc ? (
          <TaDocumentPanel doc={doc} roleTitle={req.roleTitle} invalidate={KEYS} />
        ) : (
          <p className='rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500'>
            No {label} yet{isRecruiter ? '' : ` — ${position.recruiterName ?? 'the recruiter'} writes it`}.
          </p>
        )}
        {isRecruiter && editable(doc) && (
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
    <div className='space-y-2'>
      {submit.error && <p className='text-sm text-red-600'>{apiErrorMessage(submit.error)}</p>}
      <div className='grid gap-3 lg:grid-cols-2'>
        {docBlock('jd')}
        {docBlock('scorecard')}
      </div>
    </div>
  );
};

/**
 * TA's workspace for one approved line: positions → recruiters (the line's
 * TA RM, who may also keep a position herself), and each position's own JD +
 * scorecard written by its recruiter.
 */
const LineWorkspace = ({ req }: { req: Requisition }) => {
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isTaRm = !!me.data && req.taRm?.id === me.data.id;

  return (
    <div className='w-full space-y-4 border-t border-slate-100 pt-3'>
      <p className='text-sm text-slate-600'>
        {req.taRm ? (
          <>
            TA RM: <span className='font-medium text-slate-800'>{req.taRm.name}</span>
            {isTaRm && ' (you) — give each position to someone in your TA team, or keep it yourself.'}
          </>
        ) : (
          'Waiting for Admin to give this line to a TA RM.'
        )}
      </p>
      <Positions req={req} isTaRm={isTaRm} meId={me.data?.id} />
      <InterviewerList req={req} canSwap={isTaRm} />
    </div>
  );
};

export default LineWorkspace;

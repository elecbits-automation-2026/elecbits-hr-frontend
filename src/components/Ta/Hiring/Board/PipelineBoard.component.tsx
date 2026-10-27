import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Application, ApplicationStage, CandidateSource } from '@app-types/api.types';
import { ROUND_LABEL, SOURCE_LABEL, STAGE_LABEL } from '@constants/Common/hiring.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { apiErrorMessage } from '@utils/apiError';

import {
  BOARD_COLUMNS,
  CLOSED_STAGES,
  STAGE_ACCENT,
  STAGE_HEAD,
  daysSince,
  type BoardPosition,
} from './board.shared';

/** Sources coloured like the old tool's pills. */
const SOURCE_CLASS: Partial<Record<CandidateSource, string>> = {
  referral: 'bg-green-600/10 text-green-700',
  linkedin: 'bg-blue-600/10 text-blue-700',
  naukri: 'bg-orange-600/10 text-orange-700',
  campus: 'bg-violet-600/10 text-violet-700',
  agency: 'bg-amber-600/10 text-amber-700',
};

/** Who may move a card: the position's recruiter or the line's TA RM. */
const canWorkOn = (item: BoardPosition, meId: string | undefined) =>
  !!meId && (item.position.recruiterId === meId || item.line.taRm?.id === meId);

/** The one forward move the rules allow from a stage, and who may make it. */
const nextMove = (
  a: Application,
  item: BoardPosition,
  meId: string | undefined,
): { label: string; run: () => Promise<Application> } | null => {
  if (!canWorkOn(item, meId)) return null;
  if (a.stage === 'sourced' || a.stage === 'shortlisted')
    return { label: 'Start screening', run: () => candidatesApi.startInterviews(a.id) };
  return null;
};

const REJECTABLE: ApplicationStage[] = [
  'sourced',
  'shortlisted',
  'interviewing',
  'interviewed',
  'decision',
  'selected',
];

const CandidateCard = ({
  a,
  item,
  meId,
  showRole,
  onOpen,
}: {
  a: Application;
  item: BoardPosition;
  meId: string | undefined;
  showRole: boolean;
  onOpen: () => void;
}) => {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const move = nextMove(a, item, meId);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  };
  const go = useMutation({ mutationFn: () => move!.run(), onSuccess: refresh });
  const reject = useMutation({
    mutationFn: () => candidatesApi.reject(a.id, reason.trim()),
    onSuccess: refresh,
  });
  const days = daysSince(a.updatedAt);

  return (
    // The whole card opens the candidate's summary; its own buttons act without opening it.
    <div
      role='button'
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && onOpen()}
      title='Open the summary and scorecard'
      className={`cursor-pointer space-y-1.5 rounded-[10px] border border-l-[3px] border-slate-200 bg-white px-2.5 py-2 hover:border-blue-300 hover:shadow-sm ${STAGE_ACCENT[a.stage]}`}
    >
      <div className='flex items-start justify-between gap-1'>
        <div className='min-w-0'>
          <p className='truncate text-[12.5px] font-bold text-slate-800'>{a.candidateName}</p>
          {showRole && (
            <p className='truncate text-[11px] text-slate-500'>
              {a.roleTitle} #{a.positionNumber}
            </p>
          )}
        </div>
        <span className='shrink-0 text-[10.5px] font-medium text-blue-700'>View →</span>
      </div>
      <div className='flex flex-wrap items-center gap-1 text-[10.5px]'>
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${SOURCE_CLASS[a.candidateSource] ?? 'bg-slate-100 text-slate-600'}`}
        >
          {SOURCE_LABEL[a.candidateSource]}
        </span>
        {a.scoreTotal !== null && (
          <span className='rounded-full bg-slate-800 px-2 py-0.5 font-mono font-semibold text-white'>
            {a.scoreTotal}/100
          </span>
        )}
      </div>
      {a.nextAction && (
        <p
          className={`text-[10.5px] ${
            a.nextAction.due && a.nextAction.due < new Date().toLocaleDateString('en-CA')
              ? 'font-semibold text-red-600'
              : 'text-slate-600'
          }`}
        >
          ▸ {a.nextAction.text}
          {a.nextAction.due && <> · {a.nextAction.due.slice(5)}</>}
        </p>
      )}
      <p className='font-mono text-[10.5px] text-slate-400'>
        {a.candidateNoticeDays !== null && <>{a.candidateNoticeDays}d notice · </>}
        {a.contactCount > 0 && <>{a.contactCount} contact{a.contactCount === 1 ? '' : 's'} · </>}
        {a.candidateExperienceYears !== null && <>{a.candidateExperienceYears} yrs · </>}
        {days === 0 ? 'moved today' : `${days}d since it last moved`}
      </p>
      {a.stage === 'interviewing' && a.currentRound && (
        <p className='text-[10.5px] font-medium text-violet-700'>
          Round open: {ROUND_LABEL[a.currentRound]}
        </p>
      )}
      {(go.error || reject.error) && (
        <p className='text-[11px] text-red-600'>{apiErrorMessage(go.error ?? reject.error)}</p>
      )}
      {rejecting ? (
        <div className='space-y-1' onClick={(e) => e.stopPropagation()}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Why not?'
            className='w-full rounded-md border border-slate-300 px-2 py-1 text-xs'
          />
          <div className='flex justify-end gap-1'>
            <button
              type='button'
              onClick={() => setRejecting(false)}
              className='rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100'
            >
              Back
            </button>
            <button
              type='button'
              disabled={!reason.trim() || reject.isPending}
              onClick={() => reject.mutate()}
              className='rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50'
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div className='flex items-center justify-between gap-1' onClick={(e) => e.stopPropagation()}>
          {canWorkOn(item, meId) && REJECTABLE.includes(a.stage) ? (
            <button
              type='button'
              onClick={() => setRejecting(true)}
              className='text-[11px] text-slate-400 hover:text-red-600'
            >
              ✕ not going ahead
            </button>
          ) : (
            <span />
          )}
          {move && (
            <button
              type='button'
              disabled={go.isPending}
              onClick={() => go.mutate()}
              title={move.label}
              className='rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50'
            >
              {move.label} →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * The candidate pipeline as a kanban board, in the old HR tool's style: one
 * column per stage (closed ones dimmed at the end), cards with the source,
 * score, experience and days since they last moved. The → button makes the
 * one move our rules allow from that stage; everything else (scheduling,
 * scores, decision, offer, hire) opens in the candidate drawer.
 */
const PipelineBoard = ({
  items,
  meId,
  showRole,
  onOpen,
}: {
  items: BoardPosition[];
  meId: string | undefined;
  showRole: boolean;
  onOpen: (a: Application, item: BoardPosition) => void;
}) => {
  const cards = items.flatMap((item) => item.apps.map((a) => ({ a, item })));
  const column = (stage: ApplicationStage, closed: boolean) => {
    const here = cards
      .filter((c) => c.a.stage === stage)
      .sort((x, y) => y.a.updatedAt.localeCompare(x.a.updatedAt));
    return (
      <section
        key={stage}
        className={`flex shrink-0 flex-col gap-2 ${closed ? 'w-44 opacity-60' : 'w-[232px]'}`}
      >
        <div
          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${STAGE_HEAD[stage]}`}
        >
          <span className='truncate'>{STAGE_LABEL[stage]}</span>
          <span className='font-mono'>{here.length}</span>
        </div>
        {here.length === 0 ? (
          <p className='rounded-lg border border-dashed border-slate-200 px-2 py-4 text-center text-[11px] text-slate-400'>
            empty
          </p>
        ) : (
          here.map(({ a, item }) => (
            <CandidateCard
              key={a.id}
              a={a}
              item={item}
              meId={meId}
              showRole={showRole}
              onOpen={() => onOpen(a, item)}
            />
          ))
        )}
      </section>
    );
  };
  const closedUsed = CLOSED_STAGES.filter((s) => cards.some((c) => c.a.stage === s));

  return (
    <div className='overflow-x-auto pb-2'>
      <div className='flex min-w-max gap-3'>
        {BOARD_COLUMNS.map((s) => column(s, false))}
        {closedUsed.length > 0 && <div className='w-px shrink-0 bg-slate-200' />}
        {closedUsed.map((s) => column(s, true))}
      </div>
    </div>
  );
};

export default PipelineBoard;

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import type { Application, RequisitionStatus } from '@app-types/api.types';
import Drawer from '@components/Common/Drawer.component';
import RequisitionCard from '@components/Common/Hiring/RequisitionCard.component';
import ApplicationRow from '@components/Ta/Hiring/ApplicationRow.component';
import CandidateTracker from '@components/Ta/Hiring/CandidateTracker.component';
import ScorecardSummary from '@components/Common/Hiring/ScorecardSummary.component';
import {
  LIVE_STAGES,
  quarterOf,
  type BoardPosition,
} from '@components/Ta/Hiring/Board/board.shared';
import HiringReports from '@components/Ta/Hiring/Board/HiringReports.component';
import PipelineBoard from '@components/Ta/Hiring/Board/PipelineBoard.component';
import RoleCard from '@components/Ta/Hiring/Board/RoleCard.component';
import LineWorkspace from '@components/Ta/Hiring/LineWorkspace.component';
import { AddCandidateControls } from '@components/Ta/Hiring/PositionPipeline.component';
import {
  REQ_STATUS_LABEL,
  ROUND_LABEL,
  STAGE_CLASS,
  STAGE_LABEL,
} from '@constants/Common/hiring.constants';
import { hiringApi } from '@services/api/hiring.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';

type Tab = 'roles' | 'pipeline' | 'lines' | 'reports';

const FILTERS: Array<RequisitionStatus | ''> = [
  '',
  'queued',
  'submitted',
  'approved',
  'returned',
  'draft',
  'cancelled',
];

const card = 'rounded-xl border border-slate-200 bg-white';

const Stat = ({
  value,
  label,
  sub,
  tone,
}: {
  value: number;
  label: string;
  sub?: string;
  tone: string;
}) => (
  <div className={`${card} p-4`}>
    <p className={`font-mono text-[30px] font-extrabold leading-none ${tone}`}>{value}</p>
    <p className='mt-1.5 text-sm font-medium text-slate-700'>{label}</p>
    {sub && <p className='text-xs text-slate-400'>{sub}</p>}
  </div>
);

/** Every hiring line, by status — the oversight list (what departments asked for). */
const LinesList = () => {
  const [status, setStatus] = useState<RequisitionStatus | ''>('');
  const list = useQuery({
    queryKey: ['hiring-requisitions', status],
    queryFn: () => hiringApi.list(status || undefined),
  });
  return (
    <div className='space-y-3'>
      <div className={`${card} flex flex-wrap items-center gap-1 p-3`}>
        {FILTERS.map((f) => (
          <button
            key={f || 'all'}
            type='button'
            onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1 text-xs ${
              status === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'queued' ? 'Queued' : f ? REQ_STATUS_LABEL[f].split(' —')[0] : 'All'}
          </button>
        ))}
      </div>
      {list.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {list.error && <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>}
      {list.data?.length === 0 && (
        <p className='rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>
          No lines here.
        </p>
      )}
      {list.data?.map((r) => (
        <RequisitionCard key={r.id} req={r} showDepartment />
      ))}
    </div>
  );
};

/**
 * TA's Hiring page, in the old HR tool's style (learner, 2026-10-27): a stat
 * row; Open roles as cards (one per position); the Pipeline as a kanban
 * board; and All lines for oversight. "Mine" shows the positions I recruit
 * for or hold as TA RM. A hiring goal links here with ?position=<id>.
 */
const HiringPage = () => {
  const [params, setParams] = useSearchParams();
  const focus = params.get('position') ?? '';
  const [tab, setTab] = useState<Tab>(focus ? 'pipeline' : 'roles');
  const [scope, setScope] = useState<'mine' | 'all' | null>(null);
  const [lineOpen, setLineOpen] = useState<string | null>(null);
  const [appOpen, setAppOpen] = useState<string | null>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const board = useQuery({ queryKey: ['hiring-requisitions', 'board'], queryFn: hiringApi.board });
  const meId = me.data?.id;

  const all: BoardPosition[] = useMemo(
    () =>
      (board.data?.lines ?? []).flatMap((line) =>
        line.positions
          .filter((p) => p.status !== 'cancelled')
          .map((position) => ({
            line,
            position,
            apps: (board.data?.applications ?? []).filter((a) => a.positionId === position.id),
          })),
      ),
    [board.data],
  );
  const isMine = (i: BoardPosition) =>
    !!meId && (i.position.recruiterId === meId || i.line.taRm?.id === meId);
  const hasMine = all.some(isMine);
  const mode = scope ?? (hasMine ? 'mine' : 'all');
  const visible = mode === 'mine' ? all.filter(isMine) : all;
  const order = ['awaiting_docs', 'open', 'interviewing', 'offer', 'filled'];
  const roles = [...visible].sort(
    (a, b) =>
      order.indexOf(a.position.status) - order.indexOf(b.position.status) ||
      a.line.roleTitle.localeCompare(b.line.roleTitle) ||
      a.position.number - b.position.number,
  );
  const shown = focus ? visible.filter((i) => i.position.id === focus) : visible;
  const focused = all.find((i) => i.position.id === focus);

  const apps = visible.flatMap((i) => i.apps);
  const thisQuarter = quarterOf(new Date().toISOString());
  const stats = {
    open: visible.filter((i) => i.position.status !== 'filled').length,
    heads: visible.filter((i) => i.position.status === 'filled').length,
    inFlight: apps.filter((a) => LIVE_STAGES.includes(a.stage)).length,
    offers: apps.filter((a) => a.stage === 'offered').length,
    hired: apps.filter((a) => a.stage === 'hired' && quarterOf(a.updatedAt) === thisQuarter)
      .length,
  };
  const oldest = Math.max(
    0,
    ...visible
      .filter((i) => i.position.openedAt && i.position.status !== 'filled')
      .map((i) => Math.floor((Date.now() - new Date(i.position.openedAt!).getTime()) / 86_400_000)),
  );

  const showPosition = (positionId: string) => {
    setParams(positionId ? { position: positionId } : {});
    setTab('pipeline');
  };
  const drawerLine = board.data?.lines.find((l) => l.id === lineOpen);
  const drawerApp: Application | undefined = board.data?.applications.find(
    (a) => a.id === appOpen,
  );
  const canAdd =
    !!focused &&
    isMine(focused) &&
    (focused.position.status === 'open' || focused.position.status === 'interviewing');

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'roles', label: 'Open roles' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'lines', label: 'All lines' },
    { key: 'reports', label: 'Reports' },
  ];

  return (
    <div className='w-full space-y-4'>
      <div className={`${card} flex flex-wrap items-center justify-between gap-3 px-4`}>
        <nav className='flex gap-1'>
          {tabs.map((t) => (
            <button
              key={t.key}
              type='button'
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-3 text-sm ${
                tab === t.key
                  ? 'border-blue-600 font-semibold text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {tab !== 'lines' && tab !== 'reports' && (
          <div className='flex rounded-lg bg-slate-100 p-0.5 text-xs'>
            {(['mine', 'all'] as const).map((m) => (
              <button
                key={m}
                type='button'
                onClick={() => setScope(m)}
                className={`rounded-md px-3 py-1.5 ${
                  mode === m ? 'bg-white font-semibold text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                {m === 'mine' ? 'Mine' : 'Everyone'}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'reports' ? (
        <HiringReports />
      ) : tab === 'lines' ? (
        <LinesList />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <Stat
              value={stats.open}
              label='Open positions'
              sub={`${stats.heads} filled`}
              tone='text-blue-600'
            />
            <Stat value={stats.inFlight} label='Candidates in flight' tone='text-violet-600' />
            <Stat value={stats.offers} label='Offers out' tone='text-amber-600' />
            <Stat value={stats.hired} label='Hired this quarter' tone='text-green-600' />
          </div>

          {board.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
          {board.error && <p className='text-sm text-red-600'>{apiErrorMessage(board.error)}</p>}

          {tab === 'roles' && board.data && (
            <>
              <div className={`${card} px-4 py-3 text-sm text-slate-600`}>
                {roles.length} position{roles.length === 1 ? '' : 's'}
                {mode === 'mine' ? ' you work on' : ' on approved lines'} · {stats.open} still open
                {oldest > 0 && <> · oldest open position: {oldest} days</>}
              </div>
              {roles.length === 0 ? (
                <p className='rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500'>
                  {mode === 'mine'
                    ? 'No positions are yours yet. Switch to Everyone to see all of them.'
                    : 'No approved lines yet.'}
                </p>
              ) : (
                <div className='grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]'>
                  {roles.map((i) => (
                    <RoleCard
                      key={i.position.id}
                      item={i}
                      onPipeline={() => showPosition(i.position.id)}
                      onDetails={() => setLineOpen(i.line.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'pipeline' && board.data && (
            <>
              <div className={`${card} flex flex-wrap items-center gap-3 px-4 py-3`}>
                <label className='flex items-center gap-2 text-sm text-slate-600'>
                  Show
                  <select
                    value={focus}
                    onChange={(e) => showPosition(e.target.value)}
                    className='rounded-md border border-slate-300 px-2 py-1.5 text-sm'
                  >
                    <option value=''>
                      Every position — {apps.length} candidate{apps.length === 1 ? '' : 's'}
                    </option>
                    {roles.map((i) => (
                      <option key={i.position.id} value={i.position.id}>
                        {i.line.roleTitle} #{i.position.number} · {i.line.departmentName} ·{' '}
                        {i.apps.length} candidate{i.apps.length === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </label>
                {focus && (
                  <button
                    type='button'
                    onClick={() => showPosition('')}
                    className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
                  >
                    Show every position
                  </button>
                )}
                {focused && (
                  <button
                    type='button'
                    onClick={() => setLineOpen(focused.line.id)}
                    className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
                  >
                    JD, scorecard &amp; recruiter
                  </button>
                )}
                <span className='ml-auto text-xs text-slate-400'>
                  {shown.flatMap((i) => i.apps).filter((a) => LIVE_STAGES.includes(a.stage)).length}{' '}
                  live ·{' '}
                  {shown.flatMap((i) => i.apps).filter((a) => !LIVE_STAGES.includes(a.stage)).length}{' '}
                  closed out
                </span>
              </div>
              {focused && focused.position.status === 'awaiting_docs' && (
                <p className='rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                  This position opens for candidates once its JD and scorecard are approved.
                </p>
              )}
              {canAdd && (
                <div className={`${card} p-3`}>
                  <AddCandidateControls positionId={focus} />
                </div>
              )}
              <PipelineBoard
                items={shown}
                meId={meId}
                showRole={!focus}
                onOpen={(a) => setAppOpen(a.id)}
              />
            </>
          )}
        </>
      )}

      {drawerLine && (
        <Drawer
          title={`${drawerLine.roleTitle} · ${drawerLine.departmentName}`}
          subtitle={`${drawerLine.quantity} position${drawerLine.quantity === 1 ? '' : 's'} · each position's recruiter writes its JD and scorecard`}
          onClose={() => setLineOpen(null)}
          wide
        >
          <LineWorkspace req={drawerLine} />
        </Drawer>
      )}
      {drawerApp && (
        <Drawer
          title={drawerApp.candidateName}
          subtitle={`${drawerApp.candidateCode ?? ''} · ${drawerApp.roleTitle} #${drawerApp.positionNumber} · ${drawerApp.departmentName}`}
          onClose={() => setAppOpen(null)}
        >
          <section className='space-y-2 rounded-lg border border-slate-200 p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-sm font-semibold text-slate-800'>Scorecard summary</p>
              <span className='flex flex-wrap items-center gap-2 text-xs'>
                <span className={`rounded-full px-2 py-0.5 font-medium ${STAGE_CLASS[drawerApp.stage]}`}>
                  {STAGE_LABEL[drawerApp.stage]}
                </span>
                {drawerApp.currentRound && (
                  <span className='text-violet-700'>Round open: {ROUND_LABEL[drawerApp.currentRound]}</span>
                )}
                <span className='rounded-full bg-slate-800 px-2 py-0.5 font-mono font-semibold text-white'>
                  {drawerApp.scoreTotal === null ? 'not scored yet' : `${drawerApp.scoreTotal} / 100`}
                </span>
              </span>
            </div>
            <ScorecardSummary app={drawerApp} />
            <p className='text-[11px] text-slate-400'>
              Click a scored round to see every answer&apos;s 1–4 score and the evidence.
            </p>
          </section>
          <CandidateTracker
            app={drawerApp}
            canEdit={!!meId && (drawerApp.recruiterId === meId || drawerApp.taRmId === meId)}
          />
          <ApplicationRow app={drawerApp} showRole showSummary={false} />
        </Drawer>
      )}
    </div>
  );
};

export default HiringPage;

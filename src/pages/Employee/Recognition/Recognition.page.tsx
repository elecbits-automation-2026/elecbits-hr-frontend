import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Recognition, RecognitionAward } from '@app-types/api.types';
import FeedbackModal, {
  type FeedbackDraft,
} from '@components/Employee/Home/FeedbackModal.component';
import PersonSheet, { type SheetPerson } from '@components/Employee/MyTeam/PersonSheet.component';
import { CITATION_MAX_LENGTH } from '@constants/Common/rules.constants';
import { usePublicSettings } from '@hooks/Common/usePublicSettings.hook';
import { attendanceApi } from '@services/api/attendance.api';
import { employeesApi } from '@services/api/employees.api';
import { meApi } from '@services/api/me.api';
import { recognitionsApi } from '@services/api/recognitions.api';
import { apiErrorMessage } from '@utils/apiError';
import { holdsPortal } from '@utils/sections';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);

const CADENCE_LABEL: Record<RecognitionAward['cadence'], string> = {
  any: 'any time',
  monthly: 'one a month',
  quarterly: 'one a quarter',
};

const inr = (v: number) => `₹${v.toLocaleString('en-IN')}`;

const typeChip = (name: string) => (
  <span className='rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700'>
    {name}
  </span>
);

const statusChip = (r: Recognition) => {
  const cls =
    r.status === 'approved'
      ? 'bg-green-50 text-green-700'
      : r.status === 'declined'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-700';
  const label = r.status === 'pending' ? 'with HR' : r.status;
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
};

/**
 * Nominate: a manager picks from their OWN reports (HR also sees the
 * self-governing top). A team award can name several of them — the value is
 * split equally. HR gives the final approval; it pays in next month's payslip.
 */
const NominateModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [citation, setCitation] = useState('');
  const { citationMinLength } = usePublicSettings();

  const directory = useQuery({
    queryKey: ['recognition-directory'],
    queryFn: recognitionsApi.directory,
  });
  const catalog = useQuery({ queryKey: ['recognition-catalog'], queryFn: recognitionsApi.catalog });
  const award = (catalog.data ?? []).find((a) => a.key === type) ?? catalog.data?.[0];
  const team = award?.team ?? false;

  const nominate = useMutation({
    mutationFn: () =>
      recognitionsApi.nominate({
        employeeIds: team ? picked : picked.slice(0, 1),
        type: award!.key,
        citation: citation.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recognitions-sent'] });
      queryClient.invalidateQueries({ queryKey: ['recognitions-pending'] });
      onClose();
    },
  });

  const short = citation.trim().length < citationMinLength;
  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  const share = award && picked.length > 1 ? Math.floor(award.valueInr / picked.length) : null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>Nominate</h2>
        <p className='mt-1 text-xs text-slate-400'>
          You can nominate people who report to you. HR gives the final approval; an approved award
          is paid in next month&rsquo;s payslip.
        </p>

        <label className='mt-4 block text-sm'>
          <span className='text-slate-600'>Award</span>
          <select
            value={award?.key ?? ''}
            onChange={(e) => {
              setType(e.target.value);
              setPicked((p) => p.slice(0, 1));
            }}
            className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            {(catalog.data ?? []).map((a) => (
              <option key={a.key} value={a.key}>
                {a.name} · {inr(a.valueInr)} · {CADENCE_LABEL[a.cadence]}
                {a.team ? ' · team' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className='mt-3 text-sm'>
          <span className='text-slate-600'>{team ? 'Who (tick everyone on the team)' : 'Who'}</span>
          {team ? (
            <div className='mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-300 p-2'>
              {(directory.data ?? []).map((p) => (
                <label key={p.id} className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={picked.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className='h-4 w-4'
                  />
                  {p.name}
                  {p.designation && <span className='text-xs text-slate-400'>{p.designation}</span>}
                </label>
              ))}
            </div>
          ) : (
            <select
              value={picked[0] ?? ''}
              onChange={(e) => setPicked(e.target.value ? [e.target.value] : [])}
              className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
            >
              <option value=''>Choose…</option>
              {(directory.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.designation ? `— ${p.designation}` : ''}
                </option>
              ))}
            </select>
          )}
          {share !== null && (
            <span className='text-xs text-slate-500'>
              {inr(award!.valueInr)} split {picked.length} ways ≈ {inr(share)} each
            </span>
          )}
        </div>

        <label className='mt-3 block text-sm'>
          <span className='text-slate-600'>Why — they will read this</span>
          <textarea
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            rows={4}
            maxLength={CITATION_MAX_LENGTH}
            placeholder='What did they do, and what did it change?'
            className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <span className={`text-xs ${short ? 'text-amber-600' : 'text-green-600'}`}>
            {citation.trim().length}/{citationMinLength} characters minimum · {CITATION_MAX_LENGTH}{' '}
            max
          </span>
        </label>

        {nominate.error && (
          <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(nominate.error)}</p>
        )}

        <div className='mt-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={!award || picked.length === 0 || short || nominate.isPending}
            onClick={() => nominate.mutate()}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {nominate.isPending ? 'Sending…' : 'Nominate'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CitationCard = ({
  r,
  showStatus,
  onName,
}: {
  r: Recognition;
  showStatus?: boolean;
  /** Set only when the viewer may open this person's sheet (their RM, or HR). */
  onName?: () => void;
}) => (
  <div className='rounded-lg border border-slate-200 p-3'>
    <div className='flex flex-wrap items-center gap-2'>
      {typeChip(r.awardName)}
      {r.recipients.length > 1 ? (
        <span className='font-medium text-slate-800'>
          {r.recipients.map((p) => p.name).join(', ')}
        </span>
      ) : onName ? (
        <button
          type='button'
          onClick={onName}
          title={`Open ${r.employee.name}'s sheet`}
          className='font-medium text-slate-800 hover:text-brand-600 hover:underline'
        >
          {r.employee.name}
        </button>
      ) : (
        <span className='font-medium text-slate-800'>{r.employee.name}</span>
      )}
      <span className='text-xs text-slate-400'>
        nominated by {r.nominatedBy.name}
        {r.cycle ? ` · ${r.cycle}` : ''}
      </span>
      {showStatus && statusChip(r)}
    </div>
    <p className='mt-2 text-sm text-slate-600'>“{r.citation}”</p>
    {r.status === 'declined' && r.decisionReason && (
      <p className='mt-1 text-xs text-red-600'>Declined: {r.decisionReason}</p>
    )}
  </div>
);

/**
 * R&R: the board, own awards, the nominations a manager sent, and HR's
 * approval queue (HR gives the final approval on every nomination).
 */
const RecognitionPage = () => {
  const queryClient = useQueryClient();
  const month = currentMonth();
  const [tab, setTab] = useState<'board' | 'mine' | 'sent' | 'approvals'>('board');
  const [nominating, setNominating] = useState(false);
  const [declining, setDeclining] = useState<Recognition | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [person, setPerson] = useState<SheetPerson | null>(null);
  const [noteDraft, setNoteDraft] = useState<FeedbackDraft | null>(null);

  const board = useQuery({
    queryKey: ['recognitions-board'],
    queryFn: recognitionsApi.board,
    enabled: tab === 'board',
  });
  const mine = useQuery({
    queryKey: ['recognitions-mine'],
    queryFn: recognitionsApi.mine,
    enabled: tab === 'mine',
  });
  const sent = useQuery({
    queryKey: ['recognitions-sent'],
    queryFn: recognitionsApi.sent,
    enabled: tab === 'sent',
  });
  const pending = useQuery({
    queryKey: ['recognitions-pending'],
    queryFn: recognitionsApi.pending,
  });
  // Only managers (and HR, for the top people) have anyone to nominate.
  const nominees = useQuery({
    queryKey: ['recognition-directory'],
    queryFn: recognitionsApi.directory,
  });
  const canNominate = (nominees.data?.length ?? 0) > 0;

  // ── Person sheet: a name is only a door when the viewer can actually read
  // the sheet behind it — their own chain (RM), or the whole roster (HR).
  // The server enforces the same gate; this just avoids dead-end clicks.
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get });
  const isHr = me.data ? holdsPortal(me.data, 'HRBP') : false;
  const myTeam = useQuery({
    queryKey: ['my-team'],
    queryFn: meApi.team,
    enabled: !!me.data?.hasReports,
  });
  const roster = useQuery({
    queryKey: ['employees'],
    queryFn: employeesApi.list,
    enabled: isHr,
  });
  const teamAttendance = useQuery({
    queryKey: ['team-attendance', month],
    queryFn: () => attendanceApi.team(month),
    enabled: !!me.data?.hasReports,
  });
  const orgAttendance = useQuery({
    queryKey: ['org-attendance', month, ''],
    queryFn: () => attendanceApi.org(month),
    enabled: isHr,
  });

  const sheetFor = (id: string): SheetPerson | null => {
    const emp = (roster.data ?? []).find((e) => e.id === id);
    if (emp && emp.status !== 'inactive') {
      return {
        id: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        designation: emp.designation,
        department: emp.departmentName ?? null,
        level: emp.level,
        status: emp.status,
        dateOfJoining: emp.dateOfJoining,
      };
    }
    const tm = (myTeam.data ?? []).find((t) => t.id === id);
    if (tm) {
      return {
        id: tm.id,
        name: tm.name,
        employeeCode: tm.employeeCode,
        designation: tm.designation,
        department: tm.department,
        level: tm.level,
        status: tm.status,
        dateOfJoining: tm.dateOfJoining,
      };
    }
    return null;
  };

  /** A click handler when the sheet is openable for this person, else undefined. */
  const openerFor = (id: string): (() => void) | undefined => {
    const sheet = sheetFor(id);
    return sheet ? () => setPerson(sheet) : undefined;
  };

  const daysFor = (id: string) =>
    (orgAttendance.data ?? teamAttendance.data ?? []).find((m) => m.employee.id === id)?.days ?? [];

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'approve' | 'decline';
      reason?: string;
    }) => recognitionsApi.decide(id, { decision, ...(reason ? { reason } : {}) }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recognitions-pending'] });
      queryClient.invalidateQueries({ queryKey: ['recognitions-board'] });
      queryClient.invalidateQueries({ queryKey: ['recognitions-mine'] });
      queryClient.invalidateQueries({ queryKey: ['recognitions-sent'] });
      setDeclining(null);
      setDeclineReason('');
    },
  });

  const tabs: Array<{ key: typeof tab; label: string }> = [
    { key: 'board', label: 'Board' },
    { key: 'mine', label: 'My awards' },
    ...(canNominate ? [{ key: 'sent' as const, label: 'My nominations' }] : []),
    // HR gives the final approval — only HR has this queue.
    ...(isHr
      ? [
          {
            key: 'approvals' as const,
            label: `HR approvals${pending.data?.length ? ` (${pending.data.length})` : ''}`,
          },
        ]
      : []),
  ];

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h1 className='text-2xl font-semibold text-slate-800'>Recognition</h1>
        {canNominate && (
          <button
            type='button'
            onClick={() => setNominating(true)}
            className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500'
          >
            + Nominate
          </button>
        )}
      </div>

      <div className='flex flex-wrap gap-2'>
        {tabs.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {tab === 'board' && (
          <>
            {board.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
            {board.error && <p className='text-sm text-red-600'>{apiErrorMessage(board.error)}</p>}
            {board.data && board.data.ranking.length === 0 && (
              <p className='text-sm text-slate-500'>
                Nothing on the board yet — a month at zero is a month nobody wrote it up.
              </p>
            )}
            {board.data && board.data.ranking.length > 0 && (
              <div className='space-y-4'>
                <div className='overflow-x-auto'>
                  <table className='min-w-full text-sm'>
                    <thead>
                      <tr className='text-left text-xs uppercase tracking-wide text-slate-400'>
                        <th className='py-2 pr-4'>#</th>
                        <th className='py-2 pr-4'>Person</th>
                        <th className='py-2 pr-4'>Awards</th>
                        <th className='py-2'>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.data.ranking.map((r, i) => {
                        const open = openerFor(r.employee.id);
                        return (
                          <tr key={r.employee.id} className='border-t border-slate-100'>
                            <td className='py-2 pr-4 text-slate-400'>{i + 1}</td>
                            <td className='py-2 pr-4 font-medium text-slate-700'>
                              {open ? (
                                <button
                                  type='button'
                                  onClick={open}
                                  title={`Open ${r.employee.name}'s sheet`}
                                  className='hover:text-brand-600 hover:underline'
                                >
                                  {r.employee.name}
                                </button>
                              ) : (
                                r.employee.name
                              )}
                            </td>
                            <td className='py-2 pr-4 text-slate-600'>
                              <span className='mr-2'>{r.count}</span>
                              {Object.entries(r.byType).map(([key, n]) => (
                                <span
                                  key={key}
                                  className='mr-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700'
                                >
                                  {board.data!.typeNames[key] ?? key}
                                  {n > 1 ? ` ×${n}` : ''}
                                </span>
                              ))}
                            </td>
                            <td className='py-2 text-slate-600'>{inr(r.totalInr)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h2 className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400'>
                    Recent citations
                  </h2>
                  <div className='space-y-2'>
                    {board.data.recent.map((r) => (
                      <CitationCard key={r.id} r={r} onName={openerFor(r.employee.id)} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'mine' && (
          <>
            {mine.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
            {mine.data && mine.data.length === 0 && (
              <p className='text-sm text-slate-500'>No awards yet.</p>
            )}
            <div className='space-y-2'>
              {(mine.data ?? []).map((r) => (
                <CitationCard key={r.id} r={r} />
              ))}
            </div>
          </>
        )}

        {tab === 'sent' && (
          <>
            {sent.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
            {sent.data && sent.data.length === 0 && (
              <p className='text-sm text-slate-500'>You haven&rsquo;t nominated anyone yet.</p>
            )}
            <div className='space-y-2'>
              {(sent.data ?? []).map((r) => (
                <CitationCard key={r.id} r={r} showStatus onName={openerFor(r.employee.id)} />
              ))}
            </div>
          </>
        )}

        {tab === 'approvals' && (
          <>
            {pending.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
            {pending.data && pending.data.length === 0 && (
              <p className='text-sm text-slate-500'>No nominations waiting for HR.</p>
            )}
            {decide.error && (
              <p className='mb-2 text-sm text-red-600'>{apiErrorMessage(decide.error)}</p>
            )}
            <div className='space-y-2'>
              {(pending.data ?? []).map((r) => (
                <div key={r.id} className='rounded-lg border border-slate-200 p-3'>
                  <CitationCard r={r} onName={openerFor(r.employee.id)} />
                  <div className='mt-2 flex gap-2'>
                    <button
                      type='button'
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: r.id, decision: 'approve' })}
                      className='rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50'
                    >
                      Approve
                      {r.recipients.length > 1
                        ? ` · team of ${r.recipients.length}`
                        : ` · ${inr(r.valueInr)}`}
                    </button>
                    <button
                      type='button'
                      disabled={decide.isPending}
                      onClick={() => setDeclining(r)}
                      className='rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {nominating && <NominateModal onClose={() => setNominating(false)} />}

      {person && (
        <PersonSheet
          member={person}
          days={daysFor(person.id)}
          onClose={() => setPerson(null)}
          onNote={(m) => {
            setPerson(null);
            setNoteDraft({
              recipient: { id: m.id, name: m.name },
              type: 'appreciation',
              body: `Hi ${m.name.split(' ')[0]}, `,
            });
          }}
        />
      )}
      {noteDraft && <FeedbackModal draft={noteDraft} onClose={() => setNoteDraft(null)} />}

      {declining && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
          <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-lg'>
            <h2 className='text-lg font-semibold text-slate-800'>
              Decline the nomination for {declining.recipients.map((p) => p.name).join(', ')}?
            </h2>
            <p className='mt-1 text-xs text-slate-400'>The nominator will see this reason.</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className='mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
            />
            <div className='mt-4 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setDeclining(null)}
                className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                Back
              </button>
              <button
                type='button'
                disabled={declineReason.trim().length < 3 || decide.isPending}
                onClick={() =>
                  decide.mutate({
                    id: declining.id,
                    decision: 'decline',
                    reason: declineReason.trim(),
                  })
                }
                className='rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50'
              >
                {decide.isPending ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecognitionPage;

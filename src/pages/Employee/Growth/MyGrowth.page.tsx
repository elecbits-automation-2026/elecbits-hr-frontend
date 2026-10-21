import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MyCareer, TeamCareerRow } from '@app-types/api.types';
import PromotionHistory from '@components/Employee/Growth/PromotionHistory.component';
import RoadmapNotes from '@components/Employee/Growth/RoadmapNotes.component';
import { careerApi } from '@services/api/career.api';
import { apiErrorMessage } from '@utils/apiError';

const DAY_MS = 86_400_000;

/** One line naming the weakest area — derived, in a fixed order. */
const readingOf = (c: MyCareer): string => {
  if (c.next === null) return 'Top of the ladder — the card below is for the people you grow.';
  const att = c.evidence.quarter.attainment;
  if (att !== null && att < 60)
    return `This quarter's goals are at ${att}%. Closing the gap there is the clearest signal you can send.`;
  if (c.evidence.recognitions === 0)
    return 'No recognition on record yet. When something lands well, make sure it gets written up — the board is where this card looks.';
  return 'Nothing on this card is holding you back. Ask for the conversation.';
};

const dueConversation = (r: TeamCareerRow): boolean => {
  if (r.track) return false;
  if (!r.lastRecognizedAt) return true;
  return Date.now() - Date.parse(r.lastRecognizedAt) > 90 * DAY_MS;
};

/** A report's open roadmap: its notes, with the composer (RM-or-HR). */
const TeamNotesModal = ({ row, onClose }: { row: TeamCareerRow; onClose: () => void }) => {
  const person = useQuery({
    queryKey: ['person-career', row.employee.id],
    queryFn: () => careerApi.person(row.employee.id),
  });
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-slate-800'>
              {row.employee.name}&rsquo;s roadmap
            </h2>
            {person.data?.track && (
              <p className='text-xs text-slate-400'>
                {person.data.track.bandCode} → {person.data.track.targetBand} · open since{' '}
                {person.data.track.createdAt.slice(0, 10)}
              </p>
            )}
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50'
          >
            Close
          </button>
        </div>
        <div className='mt-4'>
          {person.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
          {person.error && <p className='text-sm text-red-600'>{apiErrorMessage(person.error)}</p>}
          {person.data && (
            <RoadmapNotes
              notes={person.data.notes}
              trackId={person.data.track?.id}
              employeeId={row.employee.id}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/** Own ladder, derived evidence, and the roadmap conversation. */
const MyGrowthPage = () => {
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState<TeamCareerRow | null>(null);
  const [notesFor, setNotesFor] = useState<TeamCareerRow | null>(null);

  const mine = useQuery({ queryKey: ['my-career'], queryFn: careerApi.mine });
  const team = useQuery({ queryKey: ['career-team'], queryFn: careerApi.team });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['my-career'] });
    queryClient.invalidateQueries({ queryKey: ['career-team'] });
  };
  const request = useMutation({ mutationFn: careerApi.request, onSettled: invalidate });
  const open = useMutation({
    mutationFn: (employeeId: string) => careerApi.openTrack({ employeeId }),
    onSettled: invalidate,
  });
  const close = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: 'met' | 'closed' }) =>
      careerApi.closeTrack(id, { outcome }),
    onSettled: () => {
      invalidate();
      setClosing(null);
    },
  });

  if (mine.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (mine.error) return <p className='text-sm text-red-600'>{apiErrorMessage(mine.error)}</p>;
  if (!mine.data) return null;

  const c = mine.data;
  const current = c.ladder.find((b) => b.code === c.current)!;
  const next = c.next ? c.ladder.find((b) => b.code === c.next) : null;

  return (
    <div className='w-full space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>My growth</h1>

      {/* Current vs next band */}
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
            You are here
          </p>
          <p className='mt-1 text-lg font-semibold text-slate-800'>
            {current.code} · {current.name}
          </p>
          <p className='mt-1 text-sm text-slate-600'>{current.expects}</p>
        </div>
        {next ? (
          <div className='rounded-xl border border-brand-200 bg-white p-5'>
            <p className='text-xs font-semibold uppercase tracking-wide text-brand-600'>Next</p>
            <p className='mt-1 text-lg font-semibold text-slate-800'>
              {next.code} · {next.name}
            </p>
            <p className='mt-1 text-sm text-slate-600'>{next.expects}</p>
          </div>
        ) : (
          <div className='rounded-xl border border-slate-200 bg-white p-5'>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Next</p>
            <p className='mt-1 text-sm text-slate-500'>There is no band above this one.</p>
          </div>
        )}
      </div>

      {/* The ladder */}
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>The ladder</h2>
        <div className='mt-3 space-y-1.5'>
          {[...c.ladder].reverse().map((b) => (
            <div
              key={b.code}
              className={`flex flex-wrap items-baseline gap-2 rounded-md px-3 py-1.5 ${
                b.code === c.current ? 'bg-brand-50' : b.code === c.next ? 'bg-slate-50' : ''
              }`}
            >
              <span className='w-8 font-mono text-xs text-slate-400'>{b.code}</span>
              <span className='font-medium text-slate-700'>{b.name}</span>
              {b.code === c.current && (
                <span className='rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white'>
                  you
                </span>
              )}
              <span className='min-w-0 flex-1 text-xs text-slate-400'>{b.expects}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence + conversation */}
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
          The evidence — read from the record, not typed in
        </h2>
        <div className='mt-3 flex flex-wrap gap-6 text-sm'>
          <div>
            <p className='text-2xl font-semibold text-slate-800'>{c.evidence.punchedDays30}</p>
            <p className='text-xs text-slate-500'>days punched, last 30</p>
          </div>
          <div>
            <p className='text-2xl font-semibold text-slate-800'>{c.evidence.recognitions}</p>
            <p className='text-xs text-slate-500'>awards on the board</p>
          </div>
          <div>
            <p className='text-2xl font-semibold text-slate-800'>{c.evidence.appreciationNotes}</p>
            <p className='text-xs text-slate-500'>appreciation notes received</p>
          </div>
          <div>
            <p className='text-2xl font-semibold text-slate-800'>
              {c.evidence.quarter.attainment === null ? '—' : `${c.evidence.quarter.attainment}%`}
            </p>
            <p className='text-xs text-slate-500'>
              {c.evidence.quarter.attainment === null
                ? `no goals in ${c.evidence.quarter.name} yet`
                : `goal attainment, ${c.evidence.quarter.name}`}
            </p>
          </div>
        </div>
        <p className='mt-3 text-sm text-slate-600'>{readingOf(c)}</p>

        <div className='mt-4 border-t border-slate-100 pt-4'>
          {c.track ? (
            <div className='text-sm'>
              <span className='rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'>
                conversation open
              </span>
              <span className='ml-2 text-slate-600'>
                {c.track.bandCode} → {c.track.targetBand}
                {c.track.openedByName ? ` · opened by ${c.track.openedByName}` : ''} ·{' '}
                {c.track.createdAt.slice(0, 10)}
              </span>
              {c.track.note && <p className='mt-1 text-xs text-slate-400'>{c.track.note}</p>}
              <h3 className='mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400'>
                Notes from your manager
              </h3>
              <div className='mt-2'>
                <RoadmapNotes notes={c.notes} />
              </div>
            </div>
          ) : c.next ? (
            <>
              {request.error && (
                <p className='mb-2 text-sm text-red-600'>{apiErrorMessage(request.error)}</p>
              )}
              <button
                type='button'
                disabled={request.isPending || !c.selfRequest.allowed}
                onClick={() => request.mutate()}
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
              >
                {request.isPending ? 'Requesting…' : 'Request a roadmap conversation'}
              </button>
              {c.selfRequest.allowed ? (
                <p className='mt-1 text-xs text-slate-400'>
                  Opens a conversation with your manager about the band above this one.
                </p>
              ) : (
                <div className='mt-2 text-xs text-slate-500'>
                  <p>Not yet — you can ask once:</p>
                  <ul className='mt-1 list-disc space-y-0.5 pl-5'>
                    {c.selfRequest.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <p className='mt-1 text-slate-400'>
                    Your manager or HR can still open the conversation for you at any time.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Band history */}
      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
          Your band history
        </h2>
        {c.selfRequest.inBandSince && (
          <p className='mt-1 text-xs text-slate-400'>
            In {c.current} since {c.selfRequest.inBandSince}
          </p>
        )}
        <div className='mt-3'>
          <PromotionHistory history={c.history} />
        </div>
      </div>

      {/* Manager view */}
      {(team.data?.length ?? 0) > 0 && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
            Your people
          </h2>
          {open.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(open.error)}</p>}
          {close.error && (
            <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(close.error)}</p>
          )}
          <table className='mt-3 min-w-full text-sm'>
            <thead>
              <tr className='text-left text-xs uppercase tracking-wide text-slate-400'>
                <th className='py-2 pr-4'>Person</th>
                <th className='py-2 pr-4'>Band</th>
                <th className='py-2 pr-4'>Awards</th>
                <th className='py-2 pr-4'>Roadmap</th>
                <th className='py-2'></th>
              </tr>
            </thead>
            <tbody>
              {(team.data ?? []).map((r) => (
                <tr key={r.employee.id} className='border-t border-slate-100'>
                  <td className='py-2.5 pr-4'>
                    <span className='font-medium text-slate-700'>{r.employee.name}</span>
                    {dueConversation(r) && (
                      <span className='ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700'>
                        due a conversation
                      </span>
                    )}
                  </td>
                  <td className='py-2.5 pr-4 font-mono text-xs text-slate-500'>{r.level}</td>
                  <td className='py-2.5 pr-4 text-slate-600'>
                    {r.recognitions}
                    {r.lastRecognizedAt && (
                      <span className='ml-1 text-xs text-slate-400'>
                        (last {r.lastRecognizedAt.slice(0, 10)})
                      </span>
                    )}
                  </td>
                  <td className='py-2.5 pr-4'>
                    {r.track ? (
                      <span className='rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700'>
                        open → {r.track.targetBand}
                      </span>
                    ) : (
                      <span className='text-xs text-slate-400'>none</span>
                    )}
                  </td>
                  <td className='py-2.5 text-right'>
                    {r.track ? (
                      <span className='inline-flex gap-3'>
                        <button
                          type='button'
                          onClick={() => setNotesFor(r)}
                          className='text-xs text-brand-600 hover:underline'
                        >
                          Notes
                        </button>
                        <button
                          type='button'
                          onClick={() => setClosing(r)}
                          className='text-xs text-brand-600 hover:underline'
                        >
                          Close
                        </button>
                      </span>
                    ) : (
                      <button
                        type='button'
                        disabled={open.isPending}
                        onClick={() => open.mutate(r.employee.id)}
                        className='text-xs text-brand-600 hover:underline disabled:opacity-50'
                      >
                        Open conversation
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notesFor && <TeamNotesModal row={notesFor} onClose={() => setNotesFor(null)} />}

      {closing?.track && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
          <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-lg'>
            <h2 className='text-lg font-semibold text-slate-800'>
              Close the conversation for {closing.employee.name}?
            </h2>
            <p className='mt-1 text-xs text-slate-400'>
              “Met” means the step up is agreed; “closed” ends it without one (they wait out the
              cooldown before asking again). Changing their level on the People page closes it as
              met by itself and records the promotion.
            </p>
            <div className='mt-4 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setClosing(null)}
                className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                Back
              </button>
              <button
                type='button'
                disabled={close.isPending}
                onClick={() => close.mutate({ id: closing.track!.id, outcome: 'closed' })}
                className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50'
              >
                Closed
              </button>
              <button
                type='button'
                disabled={close.isPending}
                onClick={() => close.mutate({ id: closing.track!.id, outcome: 'met' })}
                className='rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50'
              >
                Met
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyGrowthPage;

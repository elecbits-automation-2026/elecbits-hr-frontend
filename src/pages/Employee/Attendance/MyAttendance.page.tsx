import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApprovalStatus } from '@app-types/api.types';
import ColumnChart from '@components/Common/Charts/ColumnChart.component';
import MonthCalendar from '@components/Common/Attendance/MonthCalendar.component';
import RaiseLeaveModal from '@components/Employee/Leaves/RaiseLeaveModal.component';
// Self-service regularization is DISABLED for now (user decision): only
// HRBP/Admin regularize a missed day, via HR → Attendance → Mark attendance.
// import RegularizeModal from '@components/Employee/Attendance/RegularizeModal.component';
import WfhModal from '@components/Employee/Attendance/WfhModal.component';
import { attendanceApi } from '@services/api/attendance.api';
import { leavesApi } from '@services/api/leaves.api';
import { apiErrorMessage } from '@utils/apiError';
import { attendancePct, averageHours } from '@utils/attendance';
import { wfhSlots } from '@utils/approvals';
import { bestPosition } from '@utils/geolocation';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const statusChip: Record<ApprovalStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  partially_approved: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const TIMING_LABEL: Record<string, string> = {
  ontime: 'on time',
  grace: '≤15 min off',
  late: 'late',
  early: 'left early',
  compensated: 'full hours worked',
};
const TIMING_TEXT: Record<string, string> = {
  ontime: 'text-green-700',
  grace: 'text-amber-600',
  late: 'text-red-600',
  early: 'text-red-600',
  compensated: 'text-purple-600',
};

const Chip = ({ status }: { status: ApprovalStatus }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusChip[status]}`}>
    {status.replace('_', ' ')}
  </span>
);

/**
 * Where we are: the sharpest fresh fix within a few seconds (bestPosition).
 * Denied / unavailable / slow resolves to undefined — the punch is still
 * ATTEMPTED, but the server's geo policy rejects it (403 OUT_OF_OFFICE_RANGE,
 * naming the nearest zone and the distance) unless an approved remote
 * request covers the day. The accuracy goes too: a fix vaguer than the
 * org's limit comes back 422 LOCATION_TOO_VAGUE ("turn on GPS"). Phones
 * cold-starting GPS need a few seconds more, so the window is 8 s (it ends
 * early once the fix is within 30 m).
 */
const getPosition = async (): Promise<
  { lat: number; lng: number; accuracyM: number } | undefined
> => {
  const fix = await bestPosition(8000);
  return fix ? { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM } : undefined;
};

/** Own attendance: punch buttons, classified month calendar, reg/WFH requests. */
const MyAttendancePage = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  // const [showRegularize, setShowRegularize] = useState(false); // disabled (user decision)
  const [showWfh, setShowWfh] = useState(false);
  // "Apply leave for this day" from an absent day on the calendar.
  const [leaveFor, setLeaveFor] = useState<string | null>(null);
  const balances = useQuery({
    queryKey: ['leave-balances'],
    queryFn: () => leavesApi.balances(),
    enabled: leaveFor !== null,
  });

  const view = useQuery({
    queryKey: ['my-attendance', month],
    queryFn: () => attendanceApi.me(month),
  });
  // const regs = useQuery({
  //   queryKey: ['my-regularizations'],
  //   queryFn: attendanceApi.myRegularizations,
  // });
  const wfh = useQuery({ queryKey: ['my-wfh'], queryFn: attendanceApi.myWfh });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-attendance'] });
  };
  const checkIn = useMutation({
    mutationFn: async () => attendanceApi.checkIn(await getPosition()),
    onSuccess: refresh,
  });
  const checkOut = useMutation({
    mutationFn: async () => attendanceApi.checkOut(await getPosition()),
    onSuccess: refresh,
  });
  // const cancelReg = useMutation({
  //   mutationFn: attendanceApi.cancelRegularization,
  //   onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-regularizations'] }),
  // });
  const cancelWfh = useMutation({
    mutationFn: attendanceApi.cancelWfh,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-wfh'] }),
  });

  const today = view.data?.today ?? null;
  const summary = view.data?.summary;
  // Month stats up to today (a past month: all of it) — same rules as My team.
  const todayDate = new Date().toLocaleDateString('en-CA');
  const days = view.data?.days ?? [];
  const pct = attendancePct(days, todayDate);
  const hours = averageHours(days, todayDate);
  const hourPoints = days
    .filter((d) => d.date <= todayDate && d.workedHours !== null)
    .map((d) => ({
      key: d.date,
      label: String(Number(d.date.slice(8))),
      title: new Date(`${d.date}T00:00:00`).toLocaleDateString([], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      values: [d.workedHours as number],
      note: d.status === 'wfh' ? 'remote' : undefined,
    }));
  const punchError = checkIn.error ?? checkOut.error;
  // A full-day approved leave makes today inert — the backend rejects the
  // punch anyway; hiding the buttons is the honest UI for it.
  const todayStatus = view.data?.days.find((d) => d.date === today?.date)?.status;
  const onLeaveToday = todayStatus === 'leave';

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Attendance</h1>
        <div className='flex gap-2'>
          {/* Self-service regularization disabled (user decision) — a missed
              day is fixed by HRBP/Admin and then reads "regularized" here.
          <button
            type='button'
            onClick={() => setShowRegularize(true)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Regularize
          </button> */}
          <button
            type='button'
            onClick={() => setShowWfh(true)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Request remote work
          </button>
        </div>
      </div>

      {today && (
        <div className='flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5'>
          <div className='flex-1'>
            <div className='text-xs font-medium uppercase tracking-wide text-slate-500'>Today</div>
            <div className='mt-1 text-sm text-slate-600'>
              {onLeaveToday ? (
                <span className='font-medium text-blue-700'>
                  You’re on approved leave today — enjoy the day off.
                </span>
              ) : today.checkedIn ? (
                <>
                  In {time(today.checkInAt)}
                  {today.checkInTiming && (
                    <span className={`ml-1 text-xs ${TIMING_TEXT[today.checkInTiming]}`}>
                      ({TIMING_LABEL[today.checkInTiming]})
                    </span>
                  )}
                  {today.checkedOut ? (
                    <>
                      {' · Out '}
                      {time(today.checkOutAt)}
                      {today.checkOutTiming && (
                        <span className={`ml-1 text-xs ${TIMING_TEXT[today.checkOutTiming]}`}>
                          ({TIMING_LABEL[today.checkOutTiming]})
                        </span>
                      )}
                    </>
                  ) : (
                    ' · working'
                  )}
                  {today.source === 'remote' && (
                    <span className='ml-2 text-purple-600'>remote (approved)</span>
                  )}
                </>
              ) : (
                'Not checked in yet'
              )}
            </div>
          </div>
          {!onLeaveToday && !today.checkedIn && (
            <button
              type='button'
              disabled={checkIn.isPending}
              onClick={() => checkIn.mutate()}
              className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
            >
              {checkIn.isPending ? 'Locating…' : 'Check in'}
            </button>
          )}
          {today.checkedIn && !today.checkedOut && (
            <button
              type='button'
              disabled={checkOut.isPending}
              onClick={() => checkOut.mutate()}
              className='rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50'
            >
              {checkOut.isPending ? 'Locating…' : 'Check out'}
            </button>
          )}
          {punchError && (
            <p className='w-full text-sm text-red-600'>{apiErrorMessage(punchError)}</p>
          )}
        </div>
      )}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <input
            aria-label='Month'
            type='month'
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          {summary && (
            <div className='flex flex-wrap gap-3 text-xs text-slate-500'>
              <span>
                Present: <b className='text-slate-700'>{summary.present}</b>
              </span>
              <span>
                Absent: <b className='text-slate-700'>{summary.absent}</b>
              </span>
              <span>
                Leave: <b className='text-slate-700'>{summary.leave}</b>
              </span>
              <span>
                Remote: <b className='text-slate-700'>{summary.wfh}</b>
              </span>
              <span>
                Late ins: <b className='text-slate-700'>{summary.lateIns}</b>
              </span>
              <span>
                Early outs: <b className='text-slate-700'>{summary.earlyOuts}</b>
              </span>
              <span title='Present over the working days so far (week offs, holidays and full-day leave left out; half a day counts 0.5)'>
                Attendance: <b className='text-slate-700'>{pct ? `${pct.pct}%` : '—'}</b>
              </span>
              <span title='Average over the days with a check-in and a check-out'>
                Avg hours: <b className='text-slate-700'>{hours ? `${hours.avg} h` : '—'}</b>
              </span>
            </div>
          )}
        </div>
        {view.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {view.error && <p className='text-sm text-red-600'>{apiErrorMessage(view.error)}</p>}
        {view.data && <MonthCalendar days={view.data.days} onApplyLeave={setLeaveFor} />}
        {hourPoints.length > 0 && (
          <div className='mt-5'>
            <ColumnChart
              title='Hours worked per day'
              series={[{ key: 'hours', label: 'Hours' }]}
              points={hourPoints}
              format={(n) => `${n} h`}
              footnote='Days with a check-in and a check-out only.'
            />
          </div>
        )}
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {/* "My regularizations" card disabled with self-service regularization
            (user decision) — HRBP/Admin fix missed days directly.
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='mb-3 text-sm font-semibold text-slate-700'>My regularizations</h2>
          {regs.data && regs.data.length === 0 && (
            <p className='text-sm text-slate-500'>None yet.</p>
          )}
          {regs.data?.map((r) => ( ... ))}
        </div> */}

        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='mb-3 text-sm font-semibold text-slate-700'>My remote-work requests</h2>
          {wfh.data && wfh.data.length === 0 && <p className='text-sm text-slate-500'>None yet.</p>}
          {wfh.data?.map((w) => (
            <div
              key={w.id}
              className='flex items-center justify-between border-b border-slate-100 py-2 text-sm'
            >
              <span>
                {w.startDate === w.endDate ? w.startDate : `${w.startDate} → ${w.endDate}`}
                <span className='ml-2 text-xs text-slate-500'>{wfhSlots(w)}</span>
              </span>
              <span className='flex items-center gap-2'>
                <Chip status={w.status} />
                {(w.status === 'pending' || w.status === 'partially_approved') && (
                  <button
                    type='button'
                    disabled={cancelWfh.isPending}
                    onClick={() => cancelWfh.mutate(w.id)}
                    className='text-xs text-slate-500 hover:text-red-600'
                  >
                    Cancel
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* {showRegularize && <RegularizeModal onClose={() => setShowRegularize(false)} />} */}
      {showWfh && <WfhModal onClose={() => setShowWfh(false)} />}
      {leaveFor && balances.data && (
        <RaiseLeaveModal
          types={balances.data.map((b) => b.type)}
          initialStart={leaveFor}
          onClose={() => setLeaveFor(null)}
        />
      )}
    </div>
  );
};

export default MyAttendancePage;

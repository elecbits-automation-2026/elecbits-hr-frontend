import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApprovalStatus } from '@app-types/api.types';
import MonthCalendar from '@components/Common/Attendance/MonthCalendar.component';
// Self-service regularization is DISABLED for now (user decision): only
// HRBP/Admin regularize a missed day, via HR → Attendance → Mark attendance.
// import RegularizeModal from '@components/Employee/Attendance/RegularizeModal.component';
import WfhModal from '@components/Employee/Attendance/WfhModal.component';
import { attendanceApi } from '@services/api/attendance.api';
import { apiErrorMessage } from '@utils/apiError';
import { wfhSlots } from '@utils/approvals';

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
  ontime: 'text-green-600',
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
 * Ask the browser where we are, briefly. Denied / unavailable / slow resolves
 * to undefined — the punch is still ATTEMPTED, but the server's geo policy
 * rejects it (403 OUT_OF_OFFICE_RANGE) unless an approved remote request
 * covers the day; the error toast explains what to do.
 */
const getPosition = (): Promise<{ lat: number; lng: number } | undefined> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });

/** Own attendance: punch buttons, classified month calendar, reg/WFH requests. */
const MyAttendancePage = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  // const [showRegularize, setShowRegularize] = useState(false); // disabled (user decision)
  const [showWfh, setShowWfh] = useState(false);

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
  const punchError = checkIn.error ?? checkOut.error;
  // A full-day approved leave makes today inert — the backend rejects the
  // punch anyway; hiding the buttons is the honest UI for it.
  const todayStatus = view.data?.days.find((d) => d.date === today?.date)?.status;
  const onLeaveToday = todayStatus === 'leave';

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>My attendance</h1>
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
            <div className='text-xs font-medium uppercase tracking-wide text-slate-400'>Today</div>
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
              Check in
            </button>
          )}
          {today.checkedIn && !today.checkedOut && (
            <button
              type='button'
              disabled={checkOut.isPending}
              onClick={() => checkOut.mutate()}
              className='rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50'
            >
              Check out
            </button>
          )}
          {punchError && <p className='w-full text-sm text-red-600'>{apiErrorMessage(punchError)}</p>}
        </div>
      )}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <input
            type='month'
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          {summary && (
            <div className='flex flex-wrap gap-3 text-xs text-slate-500'>
              <span>Present: <b className='text-slate-700'>{summary.present}</b></span>
              <span>Absent: <b className='text-slate-700'>{summary.absent}</b></span>
              <span>Leave: <b className='text-slate-700'>{summary.leave}</b></span>
              <span>Remote: <b className='text-slate-700'>{summary.wfh}</b></span>
              <span>Late ins: <b className='text-slate-700'>{summary.lateIns}</b></span>
              <span>Early outs: <b className='text-slate-700'>{summary.earlyOuts}</b></span>
            </div>
          )}
        </div>
        {view.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {view.error && <p className='text-sm text-red-600'>{apiErrorMessage(view.error)}</p>}
        {view.data && <MonthCalendar days={view.data.days} />}
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
            <div key={w.id} className='flex items-center justify-between border-b border-slate-100 py-2 text-sm'>
              <span>
                {w.startDate === w.endDate ? w.startDate : `${w.startDate} → ${w.endDate}`}
                <span className='ml-2 text-xs text-slate-400'>
                  {wfhSlots(w)}
                </span>
              </span>
              <span className='flex items-center gap-2'>
                <Chip status={w.status} />
                {(w.status === 'pending' || w.status === 'partially_approved') && (
                  <button
                    type='button'
                    disabled={cancelWfh.isPending}
                    onClick={() => cancelWfh.mutate(w.id)}
                    className='text-xs text-slate-400 hover:text-red-600'
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
    </div>
  );
};

export default MyAttendancePage;

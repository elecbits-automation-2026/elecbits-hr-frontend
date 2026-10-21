import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DecideLeaveInput } from '@app-types/api.types';
import ApprovalActions from '@components/Common/Attendance/ApprovalActions.component';
import TeamCalendarGrid from '@components/Common/Attendance/TeamCalendarGrid.component';
import { attendanceApi } from '@services/api/attendance.api';
import { apiErrorMessage } from '@utils/apiError';
import { wfhSlots } from '@utils/approvals';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
// (time() formatter went dormant with the regularization queue — restore both together.)
// const time = (iso: string) =>
//   new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * The RM's attendance surface: per-report month summaries plus the two
 * pending queues (regularizations, WFH). Visible only to RMs via nav gating;
 * the backend filters by relationship regardless.
 */
const TeamAttendancePage = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<'calendar' | 'summary'>('calendar');

  const team = useQuery({
    queryKey: ['team-attendance', month],
    queryFn: () => attendanceApi.team(month),
  });
  // Self-service regularization is DISABLED (user decision): nobody can raise
  // one, so the RM queue is dormant. HRBP/Admin fix missed days directly.
  // const regs = useQuery({
  //   queryKey: ['team-regularizations'],
  //   queryFn: attendanceApi.teamRegularizations,
  // });
  const wfh = useQuery({ queryKey: ['team-wfh'], queryFn: attendanceApi.teamWfh });

  // const decideReg = useMutation({
  //   mutationFn: ({ id, input }: { id: string; input: DecideLeaveInput }) =>
  //     attendanceApi.decideRegularization(id, input),
  //   onSettled: () => {
  //     queryClient.invalidateQueries({ queryKey: ['team-regularizations'] });
  //     queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
  //     queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
  //   },
  // });
  const decideWfh = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideLeaveInput }) =>
      attendanceApi.decideWfh(id, input),
    // A decision made HERE must also refresh the HR queue (and vice versa) —
    // a dual-role approver sees both surfaces (review finding M11).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['team-wfh'] });
      queryClient.invalidateQueries({ queryKey: ['wfh-queue'] });
      queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
    },
  });

  // const pendingRegs = (regs.data ?? []).filter((r) => r.status === 'pending');
  const pendingWfh = (wfh.data ?? []).filter(
    (w) => w.status === 'pending' || w.status === 'partially_approved',
  );
  const decideError = decideWfh.error;

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h1 className='text-2xl font-semibold text-slate-800'>Team attendance</h1>
        <div className='flex items-center gap-2'>
          {(['calendar', 'summary'] as const).map((v) => (
            <button
              key={v}
              type='button'
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                view === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {v}
            </button>
          ))}
          <input
            type='month'
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
        </div>
      </div>

      {decideError && <p className='text-sm text-red-600'>{apiErrorMessage(decideError)}</p>}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {team.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {team.error && <p className='text-sm text-red-600'>{apiErrorMessage(team.error)}</p>}
        {team.data && team.data.length === 0 && (
          <p className='text-sm text-slate-500'>Nobody reports to you.</p>
        )}
        {team.data && team.data.length > 0 && view === 'calendar' && (
          <TeamCalendarGrid months={team.data} today={new Date().toLocaleDateString('en-CA')} />
        )}
        {team.data && team.data.length > 0 && view === 'summary' && (
          <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-xs text-slate-500'>
                  <th className='py-2 pr-3 font-medium'>Employee</th>
                  <th className='py-2 pr-3 font-medium'>Present</th>
                  <th className='py-2 pr-3 font-medium'>Absent</th>
                  <th className='py-2 pr-3 font-medium'>Leave</th>
                  <th className='py-2 pr-3 font-medium'>Remote</th>
                  <th className='py-2 pr-3 font-medium'>Late ins</th>
                  <th className='py-2 pr-3 font-medium'>Early outs</th>
                </tr>
              </thead>
              <tbody>
                {team.data.map((t) => (
                  <tr key={t.employee.id} className='border-b border-slate-100'>
                    <td className='py-2 pr-3'>
                      {t.employee.name}
                      <span className='ml-1 font-mono text-xs text-slate-400'>
                        {t.employee.employeeCode}
                      </span>
                    </td>
                    <td className='py-2 pr-3'>{t.summary.present}</td>
                    <td className='py-2 pr-3'>{t.summary.absent}</td>
                    <td className='py-2 pr-3'>{t.summary.leave}</td>
                    <td className='py-2 pr-3'>{t.summary.wfh}</td>
                    <td className={`py-2 pr-3 ${t.summary.lateIns > 0 ? 'text-red-600' : ''}`}>
                      {t.summary.lateIns}
                    </td>
                    <td className={`py-2 pr-3 ${t.summary.earlyOuts > 0 ? 'text-red-600' : ''}`}>
                      {t.summary.earlyOuts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        {/* "Pending regularizations" queue disabled with self-service
            regularization (user decision) — HRBP/Admin mark missed days
            directly on HR → Attendance.
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2>Pending regularizations ({pendingRegs.length})</h2>
          {pendingRegs.map((r) => ( ... ApprovalActions via decideReg ... ))}
        </div> */}

        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <h2 className='mb-3 text-sm font-semibold text-slate-700'>
            Pending remote-work requests ({pendingWfh.length})
          </h2>
          {pendingWfh.length === 0 && <p className='text-sm text-slate-500'>Nothing pending.</p>}
          {pendingWfh.map((w) => (
            <div key={w.id} className='flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm'>
              <span>
                <b>{w.employee.name}</b> ·{' '}
                {w.startDate === w.endDate ? w.startDate : `${w.startDate} → ${w.endDate}`}
                {w.reason && <span className='ml-1 text-slate-500'>({w.reason})</span>}
                <span className='ml-2 text-xs text-slate-400'>
                  {wfhSlots(w)}
                </span>
              </span>
              {w.rmApprovedBy ? (
                // The RM slot is already filled — nothing left to do here.
                <span className='text-xs text-slate-400'>you approved — awaiting HR</span>
              ) : (
                <ApprovalActions
                  disabled={decideWfh.isPending}
                  onApprove={() => decideWfh.mutate({ id: w.id, input: { decision: 'approve' } })}
                  onDecline={(reason) =>
                    decideWfh.mutate({ id: w.id, input: { decision: 'decline', reason } })
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamAttendancePage;

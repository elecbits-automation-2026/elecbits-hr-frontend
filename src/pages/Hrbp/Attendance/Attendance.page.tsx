import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DecideLeaveInput } from '@app-types/api.types';
import ApprovalActions from '@components/Common/Attendance/ApprovalActions.component';
import MonthCalendar from '@components/Common/Attendance/MonthCalendar.component';
import { attendanceApi } from '@services/api/attendance.api';
import { departmentsApi } from '@services/api/departments.api';
import { apiErrorMessage } from '@utils/apiError';
import { downloadText } from '@utils/csv';
import { wfhSlots } from '@utils/approvals';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);

/** The HR attendance surface: org-wide month summaries + holiday management. */
const AttendancePage = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

  const year = Number(month.slice(0, 4));
  const org = useQuery({
    queryKey: ['org-attendance', month, zoneFilter, deptFilter],
    queryFn: () => attendanceApi.org(month, zoneFilter || undefined, deptFilter || undefined),
  });
  const zones = useQuery({ queryKey: ['punch-zones'], queryFn: attendanceApi.listZones });
  const remoteQueue = useQuery({ queryKey: ['wfh-queue'], queryFn: attendanceApi.wfhQueue });

  const [markEmployee, setMarkEmployee] = useState('');
  const [markDate, setMarkDate] = useState('');
  const [markIn, setMarkIn] = useState('09:30');
  const [markOut, setMarkOut] = useState('18:30');

  // HR marks a missed day directly — recorded as `regularized`; a single-day
  // approved leave on that date is revoked and refunded by the backend.
  const hrMark = useMutation({
    mutationFn: () =>
      attendanceApi.hrMark({
        employeeId: markEmployee,
        date: markDate,
        checkInAt: new Date(`${markDate}T${markIn}:00`).toISOString(),
        checkOutAt: new Date(`${markDate}T${markOut}:00`).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
      setMarkDate('');
    },
  });

  const decideRemote = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideLeaveInput }) =>
      attendanceApi.decideWfh(id, input),
    // onSettled + both surfaces: deciding here must refresh the RM team queue
    // too, and a 409 conflict must clear the stale row (review finding M11).
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['wfh-queue'] });
      queryClient.invalidateQueries({ queryKey: ['team-wfh'] });
      queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
    },
  });
  const holidays = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => attendanceApi.holidays(year),
  });
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });

  // CSV lands as a browser download (HRBP or PR access, enforced server-side),
  // with the same location + department filters as the table.
  const exportCsv = useMutation({
    mutationFn: () =>
      attendanceApi.exportCsv(month, deptFilter || undefined, zoneFilter || undefined),
    onSuccess: (csv) => downloadText(`attendance-${month}.csv`, csv),
  });

  const addHoliday = useMutation({
    mutationFn: attendanceApi.addHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
      setHolidayDate('');
      setHolidayName('');
    },
  });
  // Removing a holiday is two-step (user decision): first click arms the
  // inline confirmation, only "Yes" fires the mutation.
  const [confirmingHolidayId, setConfirmingHolidayId] = useState<string | null>(null);
  const removeHoliday = useMutation({
    mutationFn: attendanceApi.removeHoliday,
    onSettled: () => setConfirmingHolidayId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['org-attendance'] });
    },
  });

  const submitHoliday = (e: FormEvent) => {
    e.preventDefault();
    addHoliday.mutate({ date: holidayDate, name: holidayName.trim() });
  };

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Attendance</h1>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='month'
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value=''>All locations</option>
            {(zones.data ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value=''>All departments</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type='button'
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50'
          >
            {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
      {exportCsv.error && (
        <p className='text-sm text-red-600'>{apiErrorMessage(exportCsv.error)}</p>
      )}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {org.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {org.error && <p className='text-sm text-red-600'>{apiErrorMessage(org.error)}</p>}
        {org.data && (
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
                <th className='py-2 font-medium'></th>
              </tr>
            </thead>
            <tbody>
              {org.data.map((t) => (
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
                  <td className='py-2'>
                    <button
                      type='button'
                      onClick={() =>
                        setExpandedId(expandedId === t.employee.id ? null : t.employee.id)
                      }
                      className='text-xs text-brand-600 hover:underline'
                    >
                      {expandedId === t.employee.id ? 'Hide' : 'Calendar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {expandedId && org.data && (
          <div className='mt-4 border-t border-slate-100 pt-4'>
            <h3 className='mb-3 text-sm font-semibold text-slate-700'>
              {org.data.find((t) => t.employee.id === expandedId)?.employee.name} — {month}
            </h3>
            <MonthCalendar days={org.data.find((t) => t.employee.id === expandedId)?.days ?? []} />
          </div>
        )}
      </div>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='mb-3 text-sm font-semibold text-slate-700'>Mark attendance</h2>
        <p className='mb-3 text-xs text-slate-400'>
          For days someone worked but didn’t punch — recorded as regularized. A single-day approved
          leave on that date is revoked and its balance refunded.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            hrMark.mutate();
          }}
          className='flex flex-wrap items-end gap-2'
        >
          <select
            required
            value={markEmployee}
            onChange={(e) => setMarkEmployee(e.target.value)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value=''>Select employee…</option>
            {(org.data ?? []).map((t) => (
              <option key={t.employee.id} value={t.employee.id}>
                {t.employee.name} — {t.employee.employeeCode}
              </option>
            ))}
          </select>
          <input
            type='date'
            required
            value={markDate}
            onChange={(e) => setMarkDate(e.target.value)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <input
            type='time'
            required
            value={markIn}
            onChange={(e) => setMarkIn(e.target.value)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <input
            type='time'
            required
            value={markOut}
            onChange={(e) => setMarkOut(e.target.value)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <button
            type='submit'
            disabled={hrMark.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {hrMark.isPending ? 'Marking…' : 'Mark'}
          </button>
        </form>
        {hrMark.error && (
          <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(hrMark.error)}</p>
        )}
      </div>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='mb-3 text-sm font-semibold text-slate-700'>
          Pending remote-work requests ({(remoteQueue.data ?? []).length})
        </h2>
        {decideRemote.error && (
          <p className='mb-2 text-sm text-red-600'>{apiErrorMessage(decideRemote.error)}</p>
        )}
        {remoteQueue.data && remoteQueue.data.length === 0 && (
          <p className='text-sm text-slate-500'>Nothing pending.</p>
        )}
        {remoteQueue.data?.map((w) => (
          <div
            key={w.id}
            className='flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm'
          >
            <span>
              <b>{w.employee.name}</b> ·{' '}
              {w.startDate === w.endDate ? w.startDate : `${w.startDate} → ${w.endDate}`}
              {w.reason && <span className='ml-1 text-slate-500'>({w.reason})</span>}
              <span className='ml-2 text-xs text-slate-400'>{wfhSlots(w)}</span>
            </span>
            {w.hrApprovedBy ? (
              // The HR slot is already filled — nothing left to do here.
              <span className='text-xs text-slate-400'>HR approved — awaiting RM</span>
            ) : (
              <ApprovalActions
                disabled={decideRemote.isPending}
                onApprove={() => decideRemote.mutate({ id: w.id, input: { decision: 'approve' } })}
                onDecline={(reason) =>
                  decideRemote.mutate({ id: w.id, input: { decision: 'decline', reason } })
                }
              />
            )}
          </div>
        ))}
      </div>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <h2 className='mb-3 text-sm font-semibold text-slate-700'>Holidays {year}</h2>
        <form onSubmit={submitHoliday} className='mb-3 flex flex-wrap items-end gap-2'>
          <input
            type='date'
            required
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <input
            required
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            placeholder='Holiday name'
            className='rounded-md border border-slate-300 px-3 py-2 text-sm'
          />
          <button
            type='submit'
            disabled={addHoliday.isPending}
            className='rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            Add holiday
          </button>
        </form>
        {addHoliday.error && (
          <p className='mb-2 text-sm text-red-600'>{apiErrorMessage(addHoliday.error)}</p>
        )}
        {holidays.data && holidays.data.length === 0 && (
          <p className='text-sm text-slate-500'>No holidays recorded for {year}.</p>
        )}
        {holidays.data?.map((h) => (
          <div
            key={h.id}
            className='flex items-center justify-between border-b border-slate-100 py-2 text-sm'
          >
            <span>
              {h.date} — {h.name}
            </span>
            {confirmingHolidayId === h.id ? (
              <span className='flex items-center gap-2 text-xs whitespace-nowrap'>
                <span className='text-slate-500'>Remove this holiday?</span>
                <button
                  type='button'
                  disabled={removeHoliday.isPending}
                  onClick={() => removeHoliday.mutate(h.id)}
                  className='rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-50'
                >
                  Yes
                </button>
                <button
                  type='button'
                  onClick={() => setConfirmingHolidayId(null)}
                  className='text-slate-400 hover:text-slate-600'
                >
                  Keep it
                </button>
              </span>
            ) : (
              <button
                type='button'
                disabled={removeHoliday.isPending}
                onClick={() => setConfirmingHolidayId(h.id)}
                className='text-xs text-slate-400 hover:text-red-600'
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendancePage;

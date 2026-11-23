import { useQuery } from '@tanstack/react-query';

import type { Employee } from '@app-types/api.types';
import { attendanceApi } from '@services/api/attendance.api';

const TYPE_LABEL: Record<string, string> = {
  permanent: 'Permanent',
  intern: 'Intern',
  contract: 'Contract',
};

const STATUS: Record<Employee['status'], [string, string]> = {
  active: ['Active', 'bg-emerald-50 text-emerald-700'],
  invited: ['Invited', 'bg-violet-50 text-violet-700'],
  exiting: ['On notice', 'bg-amber-50 text-amber-700'],
  inactive: ['Left', 'bg-slate-100 text-slate-500'],
};

const tenure = (doj: string | null): string => {
  if (!doj) return '—';
  const [y1, m1, d1] = doj.split('-').map(Number) as [number, number, number];
  const now = new Date();
  let months = (now.getFullYear() - y1) * 12 + (now.getMonth() + 1 - m1);
  if (now.getDate() < d1) months -= 1;
  if (months < 0) return 'starts soon';
  if (months < 12) return `${months} mo`;
  return `${Math.floor(months / 12)} yr${months % 12 ? ` ${months % 12} mo` : ''}`;
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

/**
 * People → Employment: the terms of each record — employment type, status,
 * base location, joining date, tenure and manager. Never pay.
 */
const EmploymentTable = ({
  employees,
  everyone,
  onOpen,
  onEdit,
}: {
  employees: Employee[];
  /** The whole roster, to name each person's manager. */
  everyone: Employee[];
  onOpen: (e: Employee) => void;
  onEdit: (e: Employee) => void;
}) => {
  const zones = useQuery({ queryKey: ['punch-zones'], queryFn: attendanceApi.listZones });
  const zoneName = (id: string | null) =>
    id ? (zones.data?.find((z) => z.id === id)?.name ?? '—') : '—';
  const nameOf = (id: string | null) =>
    id ? (everyone.find((e) => e.id === id)?.name ?? '—') : '—';

  return (
    <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white'>
      <table className='w-full min-w-[56rem] text-left text-sm'>
        <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
          <tr>
            <th className='px-4 py-3'>Code</th>
            <th className='px-4 py-3'>Name & role</th>
            <th className='px-4 py-3'>Type</th>
            <th className='px-4 py-3'>Status</th>
            <th className='px-4 py-3'>Location</th>
            <th className='px-4 py-3'>Joined</th>
            <th className='px-4 py-3'>Tenure</th>
            <th className='px-4 py-3'>Manager</th>
            <th className='px-4 py-3'></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const [statusText, statusClass] = STATUS[e.status];
            const openable = e.status !== 'inactive';
            return (
              <tr
                key={e.id}
                onClick={openable ? () => onOpen(e) : undefined}
                className={`border-t border-slate-100 ${openable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              >
                <td className='px-4 py-3 text-slate-500'>{e.employeeCode}</td>
                <td className='px-4 py-3'>
                  <p className='font-medium text-slate-800'>{e.name}</p>
                  <p className='text-xs text-slate-500'>
                    {[e.designation, e.departmentName].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className='px-4 py-3 text-slate-600'>
                  {e.employmentType ? (TYPE_LABEL[e.employmentType] ?? e.employmentType) : '—'}
                </td>
                <td className='px-4 py-3'>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                    {statusText}
                  </span>
                </td>
                <td className='px-4 py-3 text-slate-600'>{zoneName(e.baseZoneId)}</td>
                <td className='px-4 py-3 text-slate-600'>{fmt(e.dateOfJoining)}</td>
                <td className='px-4 py-3 text-slate-600'>{tenure(e.dateOfJoining)}</td>
                <td className='px-4 py-3 text-slate-600'>
                  {e.reportsTo ? (
                    nameOf(e.reportsTo)
                  ) : (
                    <span className='text-xs text-slate-500'>top of the tree</span>
                  )}
                </td>
                <td className='px-4 py-3 text-right'>
                  <button
                    type='button'
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEdit(e);
                    }}
                    className='text-xs text-brand-600 hover:text-brand-500'
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
          {employees.length === 0 && (
            <tr>
              <td colSpan={9} className='px-4 py-8 text-center text-slate-500'>
                Nobody matches these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmploymentTable;

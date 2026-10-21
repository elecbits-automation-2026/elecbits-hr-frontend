import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import type { Employee } from '@app-types/api.types';
import FeedbackModal, {
  type FeedbackDraft,
} from '@components/Employee/Home/FeedbackModal.component';
import PersonSheet, { type SheetPerson } from '@components/Employee/MyTeam/PersonSheet.component';
import AddEmployeeModal from '@components/Hrbp/People/AddEmployeeModal.component';
import EditEmployeeModal from '@components/Hrbp/People/EditEmployeeModal.component';
import ImportEmployeesModal from '@components/Hrbp/People/ImportEmployeesModal.component';
import IncompleteRecords from '@components/Hrbp/People/IncompleteRecords.component';
import { ProbationReviews } from '@components/Common/Probation/Probation.component';
import RequestAccessModal from '@components/Hrbp/People/RequestAccessModal.component';
import { ADMIN_BATCHES_ROUTE } from '@constants/Common/navigation/routes.constants';
import { attendanceApi } from '@services/api/attendance.api';
import { employeesApi } from '@services/api/employees.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);

const toSheetPerson = (e: Employee): SheetPerson => ({
  id: e.id,
  name: e.name,
  employeeCode: e.employeeCode,
  designation: e.designation,
  department: e.departmentName ?? null,
  level: e.level,
  status: e.status,
  dateOfJoining: e.dateOfJoining,
});

/**
 * The HRBP roster (§2). List is scope-filtered by the backend; what renders
 * here is exactly what the caller's grants allow. Creation is top-down
 * (§5.3): the modal requires an existing reporting manager. Unclaimed records
 * get an "Invite link" action — claiming requires the single-use token, so a
 * lost or expired link is reissued here (old link stops working).
 */
const PeoplePage = () => {
  const month = currentMonth();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [person, setPerson] = useState<SheetPerson | null>(null);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [requestingFor, setRequestingFor] = useState<Employee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const {
    data: employees,
    isLoading,
    error,
  } = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  // Admin (Owner / SuperAdmin) decides access requests, so never raises one —
  // they add the person to a batch directly.
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get });
  const isAdmin = !!(me.data?.isOwner || me.data?.isSuperadmin);
  // Same key as the HR Attendance page (zone filter '') — the cache is shared.
  const orgAttendance = useQuery({
    queryKey: ['org-attendance', month, ''],
    queryFn: () => attendanceApi.org(month),
  });

  const claimLink = useMutation({
    mutationFn: employeesApi.issueClaimLink,
    onSuccess: async ({ token }, employeeId) => {
      const link = `${window.location.origin}/auth?claim=${token}`;
      try {
        await navigator.clipboard.writeText(link);
        setCopiedFor(employeeId);
        setTimeout(() => setCopiedFor(null), 2500);
      } catch {
        // Clipboard unavailable — show the link so it can be copied by hand.
        window.prompt?.('Copy the invite link:', link);
      }
    },
  });

  if (isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (error) return <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>;

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>People</h1>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setImporting(true)}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Import CSV
          </button>
          <button
            type='button'
            onClick={() => setAdding(true)}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
          >
            Add employee
          </button>
        </div>
      </div>
      {adding && <AddEmployeeModal onClose={() => setAdding(false)} />}
      {importing && <ImportEmployeesModal onClose={() => setImporting(false)} />}
      <IncompleteRecords />
      <ProbationReviews title='Probation reviews' hr />
      {claimLink.error && (
        <p className='text-sm text-red-600'>{apiErrorMessage(claimLink.error)}</p>
      )}
      <div className='overflow-hidden rounded-xl border border-slate-200 bg-white'>
        <table className='w-full text-left text-sm'>
          <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
            <tr>
              <th className='px-4 py-3'>Name</th>
              <th className='px-4 py-3'>Code</th>
              <th className='px-4 py-3'>Email</th>
              <th className='px-4 py-3'>Level</th>
              <th className='px-4 py-3'>Status</th>
              <th className='px-4 py-3'></th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map((employee) => {
              // The sheet's per-person reads 404 on inactive records — those
              // rows stay plain history, not a clickable sheet.
              const openable = employee.status !== 'inactive';
              return (
                <tr
                  key={employee.id}
                  onClick={openable ? () => setPerson(toSheetPerson(employee)) : undefined}
                  className={`border-t border-slate-100 ${openable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  title={openable ? `Open ${employee.name}'s sheet` : undefined}
                >
                  <td className='px-4 py-3 font-medium text-slate-800'>{employee.name}</td>
                  <td className='px-4 py-3 text-slate-500'>{employee.employeeCode}</td>
                  <td className='px-4 py-3 text-slate-500'>{employee.email}</td>
                  <td className='px-4 py-3 text-slate-500'>{employee.level}</td>
                  <td className='px-4 py-3 text-slate-500'>{employee.status}</td>
                  <td className='space-x-3 whitespace-nowrap px-4 py-3 text-right'>
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(employee);
                      }}
                      className='text-xs text-brand-600 hover:text-brand-500'
                    >
                      Edit
                    </button>
                    {openable && isAdmin && (
                      <Link
                        to={ADMIN_BATCHES_ROUTE}
                        onClick={(e) => e.stopPropagation()}
                        className='text-xs text-slate-500 hover:text-brand-600'
                      >
                        Give access
                      </Link>
                    )}
                    {openable && me.data && !isAdmin && (
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          setRequestingFor(employee);
                        }}
                        className='text-xs text-slate-500 hover:text-brand-600'
                      >
                        Request access
                      </button>
                    )}
                    {employee.status === 'invited' && (
                      <button
                        type='button'
                        disabled={claimLink.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          claimLink.mutate(employee.id);
                        }}
                        className='text-xs text-brand-600 hover:text-brand-500 disabled:opacity-50'
                      >
                        {copiedFor === employee.id ? 'Link copied!' : 'Invite link'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {(employees ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className='px-4 py-8 text-center text-slate-400'>
                  No employees yet — HRBP adds people top-down (managers first).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {person && (
        <PersonSheet
          member={person}
          days={(orgAttendance.data ?? []).find((m) => m.employee.id === person.id)?.days ?? []}
          onClose={() => setPerson(null)}
          onNote={(m) => {
            setPerson(null);
            setDraft({
              recipient: { id: m.id, name: m.name },
              type: 'appreciation',
              body: `Hi ${m.name.split(' ')[0]}, `,
            });
          }}
        />
      )}
      {draft && <FeedbackModal draft={draft} onClose={() => setDraft(null)} />}
      {editing && <EditEmployeeModal employee={editing} onClose={() => setEditing(null)} />}
      {requestingFor && (
        <RequestAccessModal employee={requestingFor} onClose={() => setRequestingFor(null)} />
      )}
    </div>
  );
};

export default PeoplePage;

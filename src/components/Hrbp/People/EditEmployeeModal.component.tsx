import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateEmployeeInput, Employee, EmploymentType, Level } from '@app-types/api.types';
import { attendanceApi } from '@services/api/attendance.api';
import { departmentsApi } from '@services/api/departments.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['intern', 'permanent', 'contract'];

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

/** Every editable field as the form holds it (strings; '' = blank). */
const formOf = (e: Employee) => ({
  firstName: e.firstName ?? '',
  middleName: e.middleName ?? '',
  lastName: e.lastName ?? '',
  email: e.email,
  employeeCode: e.employeeCode,
  phone: e.phone ?? '',
  level: e.level,
  reportsTo: e.reportsTo ?? '',
  departmentId: e.departmentId ?? '',
  baseZoneId: e.baseZoneId ?? '',
  designation: e.designation ?? '',
  employmentType: (e.employmentType ?? '') as '' | EmploymentType,
  dateOfJoining: e.dateOfJoining ?? '',
  offerDate: e.offerDate ?? '',
  confirmationDate: e.confirmationDate ?? '',
  noticeDays: e.noticeDays === null ? '' : String(e.noticeDays),
  workStart: e.workStart ?? '',
  workEnd: e.workEnd ?? '',
});
type Form = ReturnType<typeof formOf>;

/**
 * HR's record editor (hrbp.people update): placement, terms and status.
 * Only CHANGED fields are sent, so untouched blanks stay untouched. The
 * backend refuses reporting cycles, deactivating yourself or the
 * administration account, and "active" on anything but a deactivated record
 * (an invited person becomes active by claiming). Deactivation ends every
 * session at once; history is kept, nothing is deleted.
 */
const EditEmployeeModal = ({ employee, onClose }: { employee: Employee; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const initial = formOf(employee);
  const [form, setForm] = useState<Form>(initial);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });
  const { data: zones } = useQuery({ queryKey: ['punch-zones'], queryFn: attendanceApi.listZones });

  // A manager must be live and can't be the person themselves (the backend
  // also refuses anyone further down their own chain).
  const managers = (employees ?? []).filter((e) => e.status !== 'inactive' && e.id !== employee.id);
  const directReports = (employees ?? []).filter(
    (e) => e.reportsTo === employee.id && e.status !== 'inactive',
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employees-incomplete'] });
  };
  const save = useMutation({
    mutationFn: (input: Partial<CreateEmployeeInput>) => employeesApi.update(employee.id, input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  const setStatus = useMutation({
    mutationFn: (status: 'active' | 'inactive') => employeesApi.update(employee.id, { status }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const changes = (): Partial<CreateEmployeeInput> => {
    const out: Record<string, unknown> = {};
    // Personal hours travel as a pair; clearing both returns them to the zone's.
    const hoursChanged =
      form.workStart !== initial.workStart || form.workEnd !== initial.workEnd;
    if (hoursChanged) {
      out.workStart = form.workStart || null;
      out.workEnd = form.workEnd || null;
    }
    for (const k of Object.keys(form) as (keyof Form)[]) {
      if (k === 'workStart' || k === 'workEnd') continue;
      const now = form[k].trim();
      if (now === initial[k].trim() || now === '') continue;
      out[k] = k === 'noticeDays' ? Number(now) : now;
    }
    return out as Partial<CreateEmployeeInput>;
  };
  const pending = changes();
  const nothingChanged = Object.keys(pending).length === 0;

  const text = (k: keyof Form, label: string, props: Record<string, unknown> = {}) => (
    <div className='space-y-1'>
      <label htmlFor={`edit-${k}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`edit-${k}`}
        value={form[k]}
        onChange={(e) => set(k, e.target.value as Form[typeof k])}
        className={inputClass}
        {...props}
      />
    </div>
  );

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate(pending);
        }}
        className='max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
      >
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>
            Edit {employee.name}
            <span className='ml-2 font-mono text-xs font-normal text-slate-400'>
              {employee.status}
            </span>
          </h2>
          <button
            type='button'
            onClick={onClose}
            className='text-sm text-slate-400 hover:text-slate-600'
          >
            ✕
          </button>
        </div>

        <div className='grid grid-cols-3 gap-3'>
          {text('firstName', 'First name')}
          {text('middleName', 'Middle name')}
          {text('lastName', 'Last name')}
        </div>
        <div className='grid grid-cols-2 gap-3'>
          {text('email', 'Company email', { type: 'email' })}
          {text('employeeCode', 'Employee code')}
        </div>
        <div className='grid grid-cols-2 gap-3'>
          {text('phone', 'Phone (10 digits)', { inputMode: 'numeric', pattern: '\\d{10}' })}
          {text('designation', 'Designation', { maxLength: 120 })}
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label htmlFor='edit-reportsTo' className={labelClass}>
              Reporting manager
            </label>
            <select
              id='edit-reportsTo'
              value={form.reportsTo}
              onChange={(e) => set('reportsTo', e.target.value)}
              className={inputClass}
            >
              {!form.reportsTo && <option value=''>Not set</option>}
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.employeeCode}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <label htmlFor='edit-level' className={labelClass}>
              Level
            </label>
            <select
              id='edit-level'
              value={form.level}
              onChange={(e) => set('level', e.target.value as Level)}
              className={inputClass}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label htmlFor='edit-departmentId' className={labelClass}>
              Department
            </label>
            <select
              id='edit-departmentId'
              value={form.departmentId}
              onChange={(e) => set('departmentId', e.target.value)}
              className={inputClass}
            >
              {!form.departmentId && <option value=''>Not set</option>}
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <label htmlFor='edit-baseZoneId' className={labelClass}>
              Base location
            </label>
            <select
              id='edit-baseZoneId'
              value={form.baseZoneId}
              onChange={(e) => set('baseZoneId', e.target.value)}
              className={inputClass}
            >
              {!form.baseZoneId && <option value=''>Not set</option>}
              {(zones ?? []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label htmlFor='edit-employmentType' className={labelClass}>
              Employment type
            </label>
            <select
              id='edit-employmentType'
              value={form.employmentType}
              onChange={(e) => set('employmentType', e.target.value as '' | EmploymentType)}
              className={inputClass}
            >
              {!form.employmentType && <option value=''>Not set</option>}
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {text('noticeDays', 'Notice period (days)', { type: 'number', min: 0 })}
        </div>

        <div className='space-y-1'>
          <span className={labelClass}>Personal work hours (optional — overrides their location&rsquo;s hours)</span>
          <div className='grid grid-cols-2 gap-3'>
            <input
              id='edit-workStart'
              aria-label='Personal work start'
              type='time'
              value={form.workStart}
              onChange={(e) => set('workStart', e.target.value)}
              className={inputClass}
            />
            <input
              id='edit-workEnd'
              aria-label='Personal work end'
              type='time'
              value={form.workEnd}
              onChange={(e) => set('workEnd', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className='grid grid-cols-3 gap-3'>
          {text('dateOfJoining', 'Joining date', { type: 'date' })}
          {text('offerDate', 'Offer date', { type: 'date' })}
          {text('confirmationDate', 'Confirmation date', { type: 'date' })}
        </div>

        {save.error && <p className='text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={nothingChanged || save.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        <section className='space-y-2 border-t border-slate-100 pt-4'>
          <h3 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>Status</h3>
          {employee.status === 'inactive' ? (
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-sm text-slate-500'>
                Deactivated. Reactivating lets them sign in again with a fresh login.
              </p>
              <button
                type='button'
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate('active')}
                className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40'
              >
                Reactivate
              </button>
            </div>
          ) : (
            <div className='space-y-2'>
              <p className='text-sm text-slate-500'>
                Deactivating signs them out everywhere at once and blocks sign-in. Their history
                stays; nothing is deleted.
              </p>
              {directReports.length > 0 && (
                <p className='rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800'>
                  {directReports.length}{' '}
                  {directReports.length === 1 ? 'person reports' : 'people report'} to{' '}
                  {employee.name} ({directReports.map((r) => r.name).join(', ')}). Give them a new
                  manager first.
                </p>
              )}
              <div className='flex justify-end'>
                <button
                  type='button'
                  disabled={setStatus.isPending}
                  onClick={() =>
                    confirmDeactivate ? setStatus.mutate('inactive') : setConfirmDeactivate(true)
                  }
                  className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-40 ${
                    confirmDeactivate
                      ? 'bg-red-600 font-medium text-white hover:bg-red-500'
                      : 'border border-red-200 text-red-700 hover:bg-red-50'
                  }`}
                >
                  {confirmDeactivate ? `Yes, deactivate ${employee.name}` : 'Deactivate'}
                </button>
              </div>
            </div>
          )}
          {setStatus.error && (
            <p className='text-sm text-red-600'>{apiErrorMessage(setStatus.error)}</p>
          )}
        </section>
      </form>
    </div>
  );
};

export default EditEmployeeModal;

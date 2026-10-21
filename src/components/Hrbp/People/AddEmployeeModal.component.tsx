import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateEmployeeInput, EmploymentType, Level } from '@app-types/api.types';
import { attendanceApi } from '@services/api/attendance.api';
import { departmentsApi } from '@services/api/departments.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['intern', 'permanent', 'contract'];

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

/**
 * Top-down employee creation (§5.3): the reporting manager is required and
 * must already exist, so the RM select is fed from the same roster the page
 * shows. The backend attaches the Employee batch and writes the audit row —
 * this form only collects the record.
 */
const AddEmployeeModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [phone, setPhone] = useState('');
  const [level, setLevel] = useState<Level>('L1');
  const [reportsTo, setReportsTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [baseZoneId, setBaseZoneId] = useState('');
  const [designation, setDesignation] = useState('');
  const [employmentType, setEmploymentType] = useState<'' | EmploymentType>('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [offerDate, setOfferDate] = useState('');
  const [confirmationDate, setConfirmationDate] = useState('');
  const [noticeDays, setNoticeDays] = useState('');

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });
  const { data: zones } = useQuery({ queryKey: ['punch-zones'], queryFn: attendanceApi.listZones });

  const managers = (employees ?? []).filter((e) => e.status !== 'inactive');

  const createDepartment = useMutation({
    mutationFn: departmentsApi.create,
    onSuccess: (dept) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDepartmentId(dept.id);
      setNewDeptName('');
    },
  });

  const createEmployee = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // The backend schema is strict and phone has a min length — send only
    // the optional fields that actually hold a value. The full name is
    // derived server-side from first + middle + last.
    const input: CreateEmployeeInput = {
      firstName: firstName.trim(),
      email,
      employeeCode,
      level,
      reportsTo,
    };
    if (middleName.trim()) input.middleName = middleName.trim();
    if (lastName.trim()) input.lastName = lastName.trim();
    if (phone.trim()) input.phone = phone.trim();
    if (departmentId) input.departmentId = departmentId;
    if (baseZoneId) input.baseZoneId = baseZoneId;
    if (designation.trim()) input.designation = designation.trim();
    if (employmentType) input.employmentType = employmentType;
    if (dateOfJoining) input.dateOfJoining = dateOfJoining;
    if (offerDate) input.offerDate = offerDate;
    if (confirmationDate) input.confirmationDate = confirmationDate;
    if (noticeDays.trim()) input.noticeDays = Number(noticeDays);
    createEmployee.mutate(input);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <form
        onSubmit={submit}
        className='max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'
      >
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>Add employee</h2>
          <button
            type='button'
            onClick={onClose}
            className='text-sm text-slate-400 hover:text-slate-600'
          >
            ✕
          </button>
        </div>

        <div className='grid grid-cols-3 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>First name</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              placeholder='Asha'
            />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Middle name</label>
            <input
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              placeholder='Verma'
            />
          </div>
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Company email</label>
          <input
            type='email'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder='asha@elecbits.in'
          />
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>Employee code</label>
            <input
              required
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className={inputClass}
              placeholder='EB-0002'
            />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
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

        <div className='space-y-1'>
          <label className={labelClass}>Phone (optional)</label>
          <input
            value={phone}
            inputMode='numeric'
            maxLength={10}
            // 10 digits exactly (user decision): strip non-digits, cap at 10.
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className={inputClass}
          />
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Reporting manager</label>
          <select
            required
            value={reportsTo}
            onChange={(e) => setReportsTo(e.target.value)}
            className={inputClass}
          >
            <option value=''>Select a manager…</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.employeeCode}
              </option>
            ))}
          </select>
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Department</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className={inputClass}
          >
            <option value=''>No department</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className='flex gap-2 pt-1'>
            <input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className={inputClass}
              placeholder='New department name'
            />
            <button
              type='button'
              disabled={!newDeptName.trim() || createDepartment.isPending}
              onClick={() => createDepartment.mutate({ name: newDeptName.trim() })}
              className='shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50'
            >
              Add
            </button>
          </div>
          {createDepartment.error && (
            <p className='text-xs text-red-600'>{apiErrorMessage(createDepartment.error)}</p>
          )}
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Base location</label>
          <select
            value={baseZoneId}
            onChange={(e) => setBaseZoneId(e.target.value)}
            className={inputClass}
          >
            <option value=''>No base location</option>
            {(zones ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
                {z.workStart ? ` (${z.workStart}–${z.workEnd})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>Designation</label>
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className={inputClass}
              placeholder='Hardware Engineer'
            />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Employment type</label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as '' | EmploymentType)}
              className={inputClass}
            >
              <option value=''>—</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>Date of joining</label>
            <input
              type='date'
              value={dateOfJoining}
              onChange={(e) => setDateOfJoining(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Offer date</label>
            <input
              type='date'
              value={offerDate}
              onChange={(e) => setOfferDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Confirmation date</label>
            <input
              type='date'
              value={confirmationDate}
              onChange={(e) => setConfirmationDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Notice (days)</label>
            <input
              type='number'
              min={0}
              value={noticeDays}
              onChange={(e) => setNoticeDays(e.target.value)}
              className={inputClass}
              placeholder='30'
            />
          </div>
        </div>

        {createEmployee.error && (
          <p className='text-sm text-red-600'>{apiErrorMessage(createEmployee.error)}</p>
        )}

        <div className='flex justify-end gap-2 pt-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={createEmployee.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {createEmployee.isPending ? 'Adding…' : 'Add employee'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddEmployeeModal;

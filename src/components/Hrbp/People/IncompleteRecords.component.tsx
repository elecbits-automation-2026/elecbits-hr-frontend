import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { IncompleteRecord } from '@app-types/api.types';
import { departmentsApi } from '@services/api/departments.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm';

const FIELD_LABELS: Record<IncompleteRecord['missing'][number], string> = {
  dateOfJoining: 'joining date',
  departmentId: 'department',
  designation: 'designation',
};

/** One record's inline completion form — only the missing fields are asked. */
const CompleteRow = ({ record }: { record: IncompleteRecord }) => {
  const queryClient = useQueryClient();
  const { employee, missing } = record;
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
    enabled: missing.includes('departmentId'),
  });

  const save = useMutation({
    mutationFn: () =>
      employeesApi.update(employee.id, {
        ...(dateOfJoining ? { dateOfJoining } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(designation.trim() ? { designation: designation.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-incomplete'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const nothingEntered = !dateOfJoining && !departmentId && !designation.trim();

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save.mutate();
      }}
      className='flex flex-wrap items-center gap-2 border-t border-amber-100 py-2.5 first:border-t-0'
    >
      <span className='min-w-40 flex-1 text-sm'>
        <span className='font-medium text-slate-800'>{employee.name}</span>
        <span className='ml-2 font-mono text-xs text-slate-400'>{employee.employeeCode}</span>
        <span className='block text-xs text-amber-700'>
          Missing {missing.map((f) => FIELD_LABELS[f]).join(', ')}
        </span>
      </span>
      {missing.includes('dateOfJoining') && (
        <input
          type='date'
          aria-label='Joining date'
          value={dateOfJoining}
          onChange={(e) => setDateOfJoining(e.target.value)}
          className={inputClass}
        />
      )}
      {missing.includes('departmentId') && (
        <select
          aria-label='Department'
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className={inputClass}
        >
          <option value=''>Department…</option>
          {(departments.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}
      {missing.includes('designation') && (
        <input
          aria-label='Designation'
          placeholder='Designation'
          maxLength={120}
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          className={`${inputClass} w-40`}
        />
      )}
      <button
        type='submit'
        disabled={nothingEntered || save.isPending}
        className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40'
      >
        Save
      </button>
      {save.error && (
        <span className='basis-full text-xs text-red-600'>{apiErrorMessage(save.error)}</span>
      )}
    </form>
  );
};

/**
 * HR's incomplete-records strip (refinement plan, Phase 1): live records the
 * Admin invite (or an older import) left without a joining date, department
 * or designation, each completable inline. Hidden when everyone is complete.
 */
const IncompleteRecords = () => {
  const [open, setOpen] = useState(false);
  const records = useQuery({
    queryKey: ['employees-incomplete'],
    queryFn: employeesApi.incomplete,
  });

  if (!records.data || records.data.length === 0) return null;
  const n = records.data.length;

  return (
    <section className='rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='flex w-full items-center justify-between text-left text-sm'
      >
        <span>
          <span className='font-medium text-amber-800'>
            {n} {n === 1 ? 'record is' : 'records are'} incomplete
          </span>
          <span className='ml-2 text-amber-700'>
            — missing a joining date, department or designation
          </span>
        </span>
        <span className='text-xs text-amber-700'>{open ? 'Hide' : 'Complete them'}</span>
      </button>
      {open && (
        <div className='mt-2'>
          {records.data.map((r) => (
            <CompleteRow key={r.employee.id} record={r} />
          ))}
        </div>
      )}
    </section>
  );
};

export default IncompleteRecords;

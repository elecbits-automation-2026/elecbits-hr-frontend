import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { TrainingStream } from '@app-types/api.types';
import TrainingList from '@components/Common/Trainings/TrainingList.component';
import { AssignTrainingModal } from '@components/Common/Trainings/TrainingModals.component';
import { employeesApi } from '@services/api/employees.api';
import { STREAM_LABEL, trainingsApi } from '@services/api/trainings.api';
import { apiErrorMessage } from '@utils/apiError';

const selectClass = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm';

const Tile = ({ label, value, warn }: { label: string; value: number; warn?: boolean }) => (
  <div className='rounded-xl border border-slate-200 bg-white p-4'>
    <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>{label}</p>
    <p
      className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? 'text-red-700' : 'text-slate-800'}`}
    >
      {value}
    </p>
  </div>
);

/**
 * HR → Trainings (learner, 2026-11-16): everything assigned across the
 * company, filtered by stream, department or overdue, and "Assign" to one
 * person, several, or a whole department at once.
 */
const TrainingsPage = () => {
  const [assigning, setAssigning] = useState(false);
  const [stream, setStream] = useState<TrainingStream | ''>('');
  const [department, setDepartment] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');

  const all = useQuery({ queryKey: ['trainings-all'], queryFn: trainingsApi.all });
  const employees = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });

  const list = useMemo(() => all.data ?? [], [all.data]);
  const departments = useMemo(
    () => [...new Set(list.map((t) => t.employee.department ?? 'No department'))].sort(),
    [list],
  );
  const shown = list.filter(
    (t) =>
      (!stream || t.stream === stream) &&
      (!department || (t.employee.department ?? 'No department') === department) &&
      (!overdueOnly || t.overdue) &&
      `${t.title} ${t.employee.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  // The Admin account (top of the tree) takes no trainings; leavers neither.
  const people = (employees.data ?? [])
    .filter((e) => e.status !== 'inactive' && e.reportsTo !== null)
    .map((e) => ({ id: e.id, name: e.name, department: e.departmentName ?? null }));

  const open = list.filter((t) => t.status === 'assigned');
  const overdue = open.filter((t) => t.overdue).length;
  const done90 = list.filter(
    (t) => t.completedAt && Date.now() - Date.parse(t.completedAt) < 90 * 86_400_000,
  ).length;

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Trainings</h1>
          <p className='text-sm text-slate-500'>
            What everyone has been asked to learn. Managers assign to their own reports; HR to
            anyone.
          </p>
        </div>
        <button
          type='button'
          onClick={() => setAssigning(true)}
          disabled={people.length === 0}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
        >
          Assign a training
        </button>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <Tile label='Open' value={open.length} />
        <Tile label='Overdue' value={overdue} warn={overdue > 0} />
        <Tile label='Completed, last 90 days' value={done90} />
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search training or person'
          className={selectClass}
        />
        <select
          className={selectClass}
          value={stream}
          onChange={(e) => setStream(e.target.value as TrainingStream | '')}
        >
          <option value=''>Every stream</option>
          {(Object.keys(STREAM_LABEL) as TrainingStream[]).map((s) => (
            <option key={s} value={s}>
              {STREAM_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value=''>Every department</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <label className='flex items-center gap-1.5 text-sm text-slate-600'>
          <input
            type='checkbox'
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          Overdue only
        </label>
      </div>

      {all.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {all.error && <p className='text-sm text-red-600'>{apiErrorMessage(all.error)}</p>}
      {all.data && (
        <TrainingList trainings={shown} mode='manage' showPerson empty='No open trainings match.' />
      )}

      {assigning && <AssignTrainingModal people={people} onClose={() => setAssigning(false)} />}
    </div>
  );
};

export default TrainingsPage;

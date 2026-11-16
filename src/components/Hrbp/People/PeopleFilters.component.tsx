import type { Employee } from '@app-types/api.types';

import { deptOf, EMPTY_FILTER, NONE, roleOf, type PeopleFilter } from './peopleFilter';

const selectClass = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** Search + department + role (designation), shared by the Roster and Employment tabs. */
const PeopleFilters = ({
  employees,
  value,
  onChange,
  shown,
}: {
  employees: Employee[];
  value: PeopleFilter;
  onChange: (f: PeopleFilter) => void;
  shown: number;
}) => {
  const departments = [...new Set(employees.map(deptOf))].sort((a, b) =>
    a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b),
  );
  // Roles follow the department pick, so the list only offers what can match.
  const roles = [
    ...new Set(
      employees.filter((e) => !value.department || deptOf(e) === value.department).map(roleOf),
    ),
  ].sort((a, b) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b)));
  const active = value.search || value.department || value.role;

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <input
        type='search'
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        placeholder='Search name, email, code…'
        className={`${selectClass} min-w-56`}
      />
      <select
        className={selectClass}
        value={value.department}
        onChange={(e) => onChange({ ...value, department: e.target.value, role: '' })}
      >
        <option value=''>Every department</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d === NONE ? 'No department' : d}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={value.role}
        onChange={(e) => onChange({ ...value, role: e.target.value })}
      >
        <option value=''>Every role</option>
        {roles.map((r) => (
          <option key={r} value={r}>
            {r === NONE ? 'No designation' : r}
          </option>
        ))}
      </select>
      <span className='text-sm text-slate-500'>
        {shown} {shown === 1 ? 'person' : 'people'}
      </span>
      {active && (
        <button
          type='button'
          onClick={() => onChange(EMPTY_FILTER)}
          className='text-sm text-brand-600 hover:underline'
        >
          Clear filters
        </button>
      )}
    </div>
  );
};

export default PeopleFilters;

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Department, DepartmentMembership, Employee } from '@app-types/api.types';
import PageTabs from '@components/Common/Tabs/PageTabs.component';
import {
  HeadModal,
  MembersModal,
  UnitModal,
} from '@components/Hrbp/Departments/UnitModals.component';
import { departmentsApi, homeUnits, KIND_LABEL } from '@services/api/departments.api';
import { employeesApi } from '@services/api/employees.api';
import { meApi } from '@services/api/me.api';
import { settingsApi } from '@services/api/settings.api';
import { apiErrorMessage } from '@utils/apiError';
import QueryError from '@components/Common/Utilities/QueryError.component';

type Tab = 'tree' | 'chapters';

type Open =
  | { kind: 'unit'; unit: Department | null }
  | { kind: 'head'; unit: Department }
  | { kind: 'members'; unit: Department };

interface UnitNode {
  unit: Department;
  children: UnitNode[];
  /** Home members here and in every sub-unit. */
  total: number;
}

/**
 * The home tree from parent links, loop-safe like the org chart: walk from
 * the tops with a seen-set; any unit never reached sits in a parent loop and
 * is reported, not dropped.
 */
const buildTree = (all: Department[]) => {
  const units = homeUnits(all);
  const ids = new Set(units.map((d) => d.id));
  const kids = new Map<string, Department[]>();
  for (const d of units) {
    if (d.parentId && ids.has(d.parentId)) {
      kids.set(d.parentId, [...(kids.get(d.parentId) ?? []), d]);
    }
  }
  const seen = new Set<string>();
  const toNode = (d: Department): UnitNode => {
    seen.add(d.id);
    const children = (kids.get(d.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toNode);
    return { unit: d, children, total: d.memberCount + children.reduce((n, c) => n + c.total, 0) };
  };
  const roots = units
    .filter((d) => !d.parentId || !ids.has(d.parentId))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
    .map(toNode);
  return { roots, looped: units.filter((d) => !seen.has(d.id)) };
};

const kindChip = (d: Department) => (
  <span
    className={`rounded-full px-1.5 py-0.5 text-xs uppercase tracking-wide ${
      d.kind === 'division'
        ? 'bg-sky-50 text-sky-700'
        : d.kind === 'chapter'
          ? 'bg-violet-50 text-violet-700'
          : 'bg-slate-100 text-slate-500'
    }`}
  >
    {KIND_LABEL[d.kind]}
  </span>
);

const linkBtn = 'text-xs text-brand-600 hover:underline';

const UnitRow = ({
  node,
  people,
  memberships,
  expanded,
  onToggle,
  onOpen,
}: {
  node: UnitNode;
  people: Employee[];
  memberships: DepartmentMembership[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (o: Open) => void;
}) => {
  const { unit } = node;
  const open = expanded.has(unit.id);
  const home = people.filter((p) => p.departmentId === unit.id);
  const extras = memberships.filter((m) => m.departmentId === unit.id);
  const canOpen = node.children.length > 0 || home.length > 0 || extras.length > 0;
  return (
    <div>
      <div className='flex flex-wrap items-center gap-2 py-1.5'>
        {canOpen ? (
          <button
            type='button'
            onClick={() => onToggle(unit.id)}
            className='flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 text-xs text-slate-500 hover:bg-slate-50'
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? '−' : '+'}
          </button>
        ) : (
          <span className='h-5 w-5 shrink-0' />
        )}
        <span className='font-medium text-slate-800'>{unit.name}</span>
        {kindChip(unit)}
        {unit.head ? (
          <span className='text-xs text-slate-500'>
            head {unit.head.name}
            {unit.head.acting && ' (acting)'}
          </span>
        ) : (
          <span className='rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700'>
            no head
          </span>
        )}
        <span className='text-xs text-slate-500'>
          {unit.memberCount} {unit.memberCount === 1 ? 'person' : 'people'}
          {node.total > unit.memberCount && ` · ${node.total} with sub-units`}
          {unit.extraCount > 0 && ` · +${unit.extraCount} also in`}
        </span>
        <span className='ml-auto flex gap-3'>
          <button
            type='button'
            className={linkBtn}
            onClick={() => onOpen({ kind: 'members', unit })}
          >
            Members
          </button>
          <button type='button' className={linkBtn} onClick={() => onOpen({ kind: 'head', unit })}>
            Head
          </button>
          <button type='button' className={linkBtn} onClick={() => onOpen({ kind: 'unit', unit })}>
            Edit
          </button>
        </span>
      </div>
      {open && (
        <div className='ml-2.5 space-y-1 border-l border-slate-200 pl-4'>
          {(home.length > 0 || extras.length > 0) && (
            <p className='py-1 text-xs text-slate-500'>
              {home.map((p) => p.name).join(', ')}
              {extras.length > 0 && (
                <span className='text-slate-500'>
                  {home.length > 0 && ' · '}also in: {extras.map((m) => m.employeeName).join(', ')}
                </span>
              )}
            </p>
          )}
          {node.children.map((c) => (
            <UnitRow
              key={c.unit.id}
              node={c}
              people={people}
              memberships={memberships}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** One unplaced person, with a one-click home picker. */
const UnplacedRow = ({ person, units }: { person: Employee; units: Department[] }) => {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState('');
  const place = useMutation({
    mutationFn: () => employeesApi.update(person.id, { departmentId }),
    onSuccess: () => {
      for (const key of ['departments', 'employees', 'employees-incomplete']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
  return (
    <li className='flex flex-wrap items-center gap-2 py-1.5'>
      <span className='min-w-40 text-sm text-slate-800'>{person.name}</span>
      <span className='text-xs text-slate-500'>{person.designation}</span>
      <span className='ml-auto flex gap-2'>
        <select
          aria-label={`Home unit for ${person.name}`}
          className='rounded-md border border-slate-300 px-2 py-1 text-sm'
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value=''>Pick a home unit…</option>
          {units.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          type='button'
          onClick={() => place.mutate()}
          disabled={!departmentId || place.isPending}
          className='rounded-md bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-50'
        >
          Place
        </button>
      </span>
      {place.error && (
        <span className='w-full text-xs text-red-600'>{apiErrorMessage(place.error)}</span>
      )}
    </li>
  );
};

/**
 * Departments (learner, 2026-11-16): the home tree of divisions and
 * departments with their heads, cross-department chapters with their leads,
 * and who sits where. Separate from the reporting line (Org structure).
 */
const DepartmentsPage = () => {
  const [tab, setTab] = useState<Tab>('tree');
  const [open, setOpen] = useState<Open | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const memberships = useQuery({
    queryKey: ['department-memberships'],
    queryFn: departmentsApi.memberships,
  });
  const employees = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  // Which unit is the HR department (its head stays Admin-only). Read softly:
  // the backend enforces the rule either way.
  const peopleSettings = useQuery({
    queryKey: ['org-settings', 'people'],
    queryFn: () => settingsApi.list('people'),
    retry: false,
  });
  const hrDepartmentId =
    (
      peopleSettings.data?.find((s) => s.key === 'hiring.hrDepartment')?.value as
        { departmentId: string | null } | undefined
    )?.departmentId ?? null;

  const all = useMemo(() => departments.data ?? [], [departments.data]);
  const tree = useMemo(() => buildTree(all), [all]);
  const people = useMemo(
    () => (employees.data ?? []).filter((p) => p.status !== 'inactive'),
    [employees.data],
  );
  const chapters = all.filter((d) => d.kind === 'chapter');
  const homes = homeUnits(all);
  const homeIds = new Set(homes.map((d) => d.id));
  // The Admin account (top of the reporting tree) is the company, not a person to place.
  const unplaced = people.filter(
    (p) => p.reportsTo !== null && (!p.departmentId || !homeIds.has(p.departmentId)),
  );

  if (departments.isLoading || employees.isLoading) {
    return <p className='text-sm text-slate-500'>Loading…</p>;
  }
  const error = departments.error ?? employees.error;
  if (error) return <QueryError error={error} />;

  const allIds = (nodes: UnitNode[]): string[] =>
    nodes.flatMap((n) => [n.unit.id, ...allIds(n.children)]);
  const count = (k: Department['kind']) => all.filter((d) => d.kind === k).length;

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Departments</h1>
          <p className='text-sm text-slate-500'>
            Where people sit — separate from who they report to (Org structure).
          </p>
        </div>
        <button
          type='button'
          onClick={() => setOpen({ kind: 'unit', unit: null })}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700'
        >
          Add a unit
        </button>
      </div>

      <div className='flex flex-wrap gap-4 text-sm text-slate-600'>
        <span>
          <span className='font-semibold text-slate-800'>{count('division')}</span> divisions
        </span>
        <span>
          <span className='font-semibold text-slate-800'>{count('department')}</span> departments
        </span>
        <span>
          <span className='font-semibold text-slate-800'>{chapters.length}</span> chapters
        </span>
        <span>
          <span className='font-semibold text-slate-800'>
            {homes.filter((d) => !d.head).length}
          </span>{' '}
          without a head
        </span>
        <span>
          <span className='font-semibold text-slate-800'>{unplaced.length}</span> people in no
          department
        </span>
      </div>

      {tree.looped.length > 0 && (
        <p className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
          These units sit under each other in a loop and never reach the top:{' '}
          {tree.looped.map((d) => d.name).join(', ')}. Edit one and move it to the top level.
        </p>
      )}

      <PageTabs<Tab>
        tabs={[
          { key: 'tree', label: 'Divisions & departments' },
          { key: 'chapters', label: 'Chapters' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'tree' && (
        <>
          <div className='rounded-xl border border-slate-200 bg-white p-5'>
            <div className='mb-2 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setExpanded(new Set(allIds(tree.roots)))}
                className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
              >
                Expand all
              </button>
              <button
                type='button'
                onClick={() => setExpanded(new Set())}
                className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
              >
                Collapse all
              </button>
            </div>
            {tree.roots.length === 0 ? (
              <p className='text-sm text-slate-500'>No departments yet — add the first one.</p>
            ) : (
              tree.roots.map((n) => (
                <UnitRow
                  key={n.unit.id}
                  node={n}
                  people={people}
                  memberships={memberships.data ?? []}
                  expanded={expanded}
                  onOpen={setOpen}
                  onToggle={(id) =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                />
              ))
            )}
          </div>

          {unplaced.length > 0 && (
            <div className='rounded-xl border border-amber-200 bg-white p-5'>
              <h2 className='text-sm font-semibold text-slate-800'>
                In no department ({unplaced.length})
              </h2>
              <p className='text-xs text-slate-500'>
                Department-wide access, the department filter and hiring all need a home unit.
              </p>
              <ul className='mt-2 divide-y divide-slate-100'>
                {unplaced.map((p) => (
                  <UnplacedRow key={p.id} person={p} units={homes} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {tab === 'chapters' && (
        <div className='space-y-3'>
          <p className='text-sm text-slate-500'>
            Chapters group people across departments (e.g. Quality, Safety). Members keep their home
            department; a chapter changes nobody’s access or approvals.
          </p>
          {chapters.length === 0 ? (
            <div className='rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500'>
              No chapters yet. Use “Add a unit” and pick Chapter.
            </div>
          ) : (
            <div className='grid gap-3 md:grid-cols-2'>
              {chapters.map((c) => {
                const members = (memberships.data ?? []).filter((m) => m.departmentId === c.id);
                const depts = new Set(
                  members.map((m) => people.find((p) => p.id === m.employeeId)?.departmentId ?? ''),
                );
                return (
                  <div
                    key={c.id}
                    className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div>
                        <p className='font-medium text-slate-800'>{c.name}</p>
                        <p className='text-xs text-slate-500'>
                          {c.lead ? `Lead: ${c.lead.name}` : 'No lead'} · {members.length}{' '}
                          {members.length === 1 ? 'person' : 'people'} from{' '}
                          {[...depts].filter(Boolean).length} departments
                        </p>
                      </div>
                      <span className='flex gap-3'>
                        <button
                          type='button'
                          className={linkBtn}
                          onClick={() => setOpen({ kind: 'members', unit: c })}
                        >
                          Members
                        </button>
                        <button
                          type='button'
                          className={linkBtn}
                          onClick={() => setOpen({ kind: 'unit', unit: c })}
                        >
                          Edit
                        </button>
                      </span>
                    </div>
                    {members.length > 0 && (
                      <div className='flex flex-wrap gap-1.5'>
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              m.isLead
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {m.employeeName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {open?.kind === 'unit' && (
        <UnitModal unit={open.unit} all={all} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'head' && (
        <HeadModal
          unit={all.find((d) => d.id === open.unit.id) ?? open.unit}
          people={people}
          meId={me.data?.id ?? null}
          isOwner={me.data?.isOwner ?? false}
          hrDepartmentId={hrDepartmentId}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === 'members' && (
        <MembersModal
          unit={all.find((d) => d.id === open.unit.id) ?? open.unit}
          all={all}
          people={employees.data ?? []}
          memberships={memberships.data ?? []}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
};

export default DepartmentsPage;

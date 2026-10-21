import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Employee } from '@app-types/api.types';
import FeedbackModal, { type FeedbackDraft } from '@components/Employee/Home/FeedbackModal.component';
import PersonSheet, { type SheetPerson } from '@components/Employee/MyTeam/PersonSheet.component';
import { attendanceApi } from '@services/api/attendance.api';
import { departmentsApi } from '@services/api/departments.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';

const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);

interface TreeNode {
  person: Employee;
  children: TreeNode[];
}

interface OrgModel {
  roots: TreeNode[];
  headcount: number;
  managers: number;
  depth: number;
  avgSpan: number;
  noManager: Employee[];
  dangling: Employee[]; // reports_to points at nobody on the roster
  looped: Employee[]; // unreachable from any root — reporting cycle members
}

/**
 * Build the tree from reports_to, cycle-safe (adopted from the hr-tool
 * review): walk from the roots with a seen-set; whoever is never reached sits
 * in a loop and is REPORTED instead of silently dropped. Inactive people stay
 * out entirely.
 */
const buildOrg = (all: Employee[]): OrgModel => {
  const people = all.filter((p) => p.status !== 'inactive');
  const byId = new Map(people.map((p) => [p.id, p]));
  const children = new Map<string, Employee[]>();
  const noManager: Employee[] = [];
  const dangling: Employee[] = [];

  for (const p of people) {
    if (!p.reportsTo) {
      noManager.push(p);
    } else if (!byId.has(p.reportsTo)) {
      dangling.push(p);
    } else {
      const list = children.get(p.reportsTo) ?? [];
      list.push(p);
      children.set(p.reportsTo, list);
    }
  }

  const seen = new Set<string>();
  let depth = 0;
  const toNode = (p: Employee, level: number): TreeNode => {
    seen.add(p.id);
    depth = Math.max(depth, level);
    const kids = (children.get(p.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { person: p, children: kids.map((c) => toNode(c, level + 1)) };
  };
  // Roots: nobody above them (no manager, or a manager who isn't on the roster).
  const roots = [...noManager, ...dangling]
    .sort((a, b) => a.level.localeCompare(b.level) || a.name.localeCompare(b.name))
    .reverse()
    .map((p) => toNode(p, 1));

  const looped = people.filter((p) => !seen.has(p.id));
  const managers = [...children.keys()].filter((id) => seen.has(id)).length;
  const links = people.length - roots.length - looped.length;

  return {
    roots,
    headcount: people.length,
    managers,
    depth,
    avgSpan: managers > 0 ? Math.round((links / managers) * 10) / 10 : 0,
    noManager,
    dangling,
    looped,
  };
};

const statusChip = (p: Employee) =>
  p.status === 'active' ? null : (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
        p.status === 'invited' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {p.status}
    </span>
  );

const Node = ({
  node,
  deptName,
  expanded,
  onToggle,
  onOpen,
  parentIsApex = false,
}: {
  node: TreeNode;
  /** True for the people directly under the administration account — the self-governing top. */
  parentIsApex?: boolean;
  deptName: (id: string | null) => string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (p: Employee) => void;
}) => {
  const open = expanded.has(node.person.id);
  const dept = deptName(node.person.departmentId);
  return (
    <div>
      <div className='flex items-center gap-2 py-1'>
        {node.children.length > 0 ? (
          <button
            type='button'
            onClick={() => onToggle(node.person.id)}
            className='flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 text-xs text-slate-500 hover:bg-slate-50'
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? '−' : '+'}
          </button>
        ) : (
          <span className='h-5 w-5 shrink-0' />
        )}
        <button
          type='button'
          onClick={() => onOpen(node.person)}
          title={`Open ${node.person.name}'s sheet`}
          className='font-medium text-slate-800 hover:text-brand-600 hover:underline'
        >
          {node.person.name}
        </button>
        <span className='rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500'>
          {node.person.level}
        </span>
        {statusChip(node.person)}
        {parentIsApex && (
          <span
            title='Reports to the Admin account: nobody above them, so their leave, remote work and regularizations approve themselves and they set their own goals'
            className='rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-700'
          >
            self-governing
          </span>
        )}
        <span className='truncate text-xs text-slate-400'>
          {[node.person.designation, dept].filter(Boolean).join(' · ')}
        </span>
        {node.children.length > 0 && (
          <span className='text-[10px] text-slate-300'>({node.children.length})</span>
        )}
      </div>
      {open && node.children.length > 0 && (
        <div className='ml-2.5 border-l border-slate-200 pl-4'>
          {node.children.map((c) => (
            <Node
              key={c.person.id}
              node={c}
              deptName={deptName}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
              parentIsApex={node.person.reportsTo === null}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** The reporting line, drawn live from reports_to — data gaps shown, not hidden. */
const OrgStructurePage = () => {
  const month = currentMonth();
  const employees = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [person, setPerson] = useState<SheetPerson | null>(null);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  // Same key as the HR Attendance page (zone filter '') — the cache is shared.
  const orgAttendance = useQuery({
    queryKey: ['org-attendance', month, ''],
    queryFn: () => attendanceApi.org(month),
  });

  const model = useMemo(() => (employees.data ? buildOrg(employees.data) : null), [employees.data]);

  // First render: open the top two levels so the chart reads at a glance.
  if (model && !initialized) {
    const top = new Set<string>();
    for (const r of model.roots) {
      top.add(r.person.id);
      for (const c of r.children) top.add(c.person.id);
    }
    setExpanded(top);
    setInitialized(true);
  }

  const deptName = (id: string | null) =>
    id ? (departments.data?.find((d) => d.id === id)?.name ?? null) : null;

  const openSheet = (p: Employee) =>
    setPerson({
      id: p.id,
      name: p.name,
      employeeCode: p.employeeCode,
      designation: p.designation,
      department: deptName(p.departmentId ?? null),
      level: p.level,
      status: p.status,
      dateOfJoining: p.dateOfJoining,
    });

  const allIds = (nodes: TreeNode[]): string[] =>
    nodes.flatMap((n) => [n.person.id, ...allIds(n.children)]);

  if (employees.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (employees.error)
    return <p className='text-sm text-red-600'>{apiErrorMessage(employees.error)}</p>;
  if (!model) return null;

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h1 className='text-2xl font-semibold text-slate-800'>Org structure</h1>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => setExpanded(new Set(allIds(model.roots)))}
            className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
          >
            Expand all
          </button>
          <button
            type='button'
            onClick={() => setExpanded(new Set(model.roots.map((r) => r.person.id)))}
            className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className='flex flex-wrap gap-4 text-sm text-slate-600'>
        <span>
          <span className='font-semibold text-slate-800'>{model.headcount}</span> people
        </span>
        <span>
          <span className='font-semibold text-slate-800'>{model.managers}</span> managers
        </span>
        <span>
          <span className='font-semibold text-slate-800'>{model.depth}</span> levels deep
        </span>
        <span>
          avg span <span className='font-semibold text-slate-800'>{model.avgSpan}</span>
        </span>
      </div>

      {(model.dangling.length > 0 || model.looped.length > 0 || model.noManager.length > 1) && (
        <div className='space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
          {model.noManager.length > 1 && (
            <p>
              {model.noManager.length} records have no manager:{' '}
              {model.noManager.map((p) => p.name).join(', ')}. Only the Admin account should be at
              the top — everyone else needs a manager (the top people report to Admin). Set it
              under People → Edit.
            </p>
          )}
          {model.dangling.length > 0 && (
            <p>
              {model.dangling.length} report to someone not on the live roster (shown as tree
              tops): {model.dangling.map((p) => p.name).join(', ')}.
            </p>
          )}
          {model.looped.length > 0 && (
            <p>
              Reporting loop — these people's chains circle back on themselves and never reach a
              top: {model.looped.map((p) => p.name).join(', ')}. Fix their “reports to” in People.
            </p>
          )}
        </div>
      )}

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        {model.roots.map((r) => (
          <Node
            key={r.person.id}
            node={r}
            deptName={deptName}
            expanded={expanded}
            onOpen={openSheet}
            onToggle={(id) =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />
        ))}
      </div>

      {person && (
        <PersonSheet
          member={person}
          days={
            (orgAttendance.data ?? []).find((m) => m.employee.id === person.id)?.days ?? []
          }
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
    </div>
  );
};

export default OrgStructurePage;

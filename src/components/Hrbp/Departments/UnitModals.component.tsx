import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Department, DepartmentMembership, Employee, UnitKind } from '@app-types/api.types';
import { departmentsApi, homeUnits, KIND_LABEL } from '@services/api/departments.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';
import ModalShell from '@components/Common/Utilities/ModalShell.component';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';
const primaryBtn =
  'rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const secondaryBtn =
  'rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50';

/** Everything the page caches about units — refreshed after any change. */
const useInvalidate = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      'departments',
      'department-memberships',
      'employees',
      'employees-incomplete',
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
};

const Shell = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => (
  <ModalShell onClose={onClose}>
    <div className='max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
      <div className='flex items-start justify-between gap-4'>
        <h2 className='text-lg font-semibold text-slate-800'>{title}</h2>
        <button
          type='button'
          onClick={onClose}
          className='text-slate-500 hover:text-slate-600'
          aria-label='Close'
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </ModalShell>
);

const ErrorLine = ({ error }: { error: unknown }) =>
  error ? <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p> : null;

/** Ids of the unit and everything below it — never offered as its new parent. */
const subtreeIds = (all: Department[], id: string): Set<string> => {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of all) {
      if (d.parentId && out.has(d.parentId) && !out.has(d.id)) {
        out.add(d.id);
        grew = true;
      }
    }
  }
  return out;
};

/**
 * Add or edit a unit: name, kind and where it sits. A chapter sits outside the
 * tree (no parent); only an empty unit can become one — the backend says why
 * when it can't. Moving a unit never changes anyone's access.
 */
export const UnitModal = ({
  unit,
  all,
  onClose,
}: {
  unit: Department | null;
  all: Department[];
  onClose: () => void;
}) => {
  const invalidate = useInvalidate();
  const [name, setName] = useState(unit?.name ?? '');
  const [kind, setKind] = useState<UnitKind>(unit?.kind ?? 'department');
  const [parentId, setParentId] = useState(unit?.parentId ?? '');

  const blocked = unit ? subtreeIds(all, unit.id) : new Set<string>();
  const parents = homeUnits(all).filter((d) => !blocked.has(d.id));

  const save = useMutation({
    mutationFn: () => {
      const parent = kind === 'chapter' ? null : parentId || null;
      if (!unit) {
        return departmentsApi.create({ name: name.trim(), kind, parentId: parent ?? undefined });
      }
      return departmentsApi.update(unit.id, {
        ...(name.trim() !== unit.name ? { name: name.trim() } : {}),
        ...(kind !== unit.kind ? { kind } : {}),
        ...(parent !== unit.parentId ? { parentId: parent } : {}),
      });
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const unchanged =
    unit !== null &&
    name.trim() === unit.name &&
    kind === unit.kind &&
    (kind === 'chapter' ? null : parentId || null) === unit.parentId;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!unchanged) save.mutate();
  };

  return (
    <Shell title={unit ? `Edit ${unit.name}` : 'Add a unit'} onClose={onClose}>
      <form onSubmit={onSubmit} className='space-y-4'>
        <label className='block space-y-1'>
          <span className={labelClass}>Name</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            autoFocus
          />
        </label>
        <div className='space-y-1'>
          <span className={labelClass}>Kind</span>
          <div className='flex gap-2'>
            {(['division', 'department', 'chapter'] as const).map((k) => (
              <button
                key={k}
                type='button'
                onClick={() => setKind(k)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  kind === k
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className='text-xs text-slate-500'>
            {kind === 'chapter'
              ? 'A chapter groups people across departments (e.g. Quality). People join it as extra members; it has a lead with no special powers, and it never changes anyone’s access.'
              : 'Divisions and departments are people’s home units. A division usually holds departments.'}
          </p>
        </div>
        {kind !== 'chapter' && (
          <label className='block space-y-1'>
            <span className={labelClass}>Sits under</span>
            <select
              className={inputClass}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value=''>— Top level —</option>
              {parents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({KIND_LABEL[d.kind].toLowerCase()})
                </option>
              ))}
            </select>
            {unit && blocked.size > 1 && (
              <p className='text-xs text-slate-500'>
                Its own sub-units are left out, so the tree can’t loop.
              </p>
            )}
          </label>
        )}
        <ErrorLine error={save.error} />
        <div className='flex justify-end gap-2'>
          <button type='button' onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button
            type='submit'
            disabled={save.isPending || unchanged || !name.trim()}
            className={primaryBtn}
          >
            {save.isPending ? 'Saving…' : unit ? 'Save changes' : 'Add unit'}
          </button>
        </div>
      </form>
    </Shell>
  );
};

/**
 * Seat or clear a department's head. Heads have real powers (hiring plan, JD
 * approvals), so the backend keeps two rules: the HR department's head stays
 * Admin-only, and nobody seats themselves.
 */
export const HeadModal = ({
  unit,
  people,
  meId,
  isOwner,
  hrDepartmentId,
  onClose,
}: {
  unit: Department;
  people: Employee[];
  meId: string | null;
  isOwner: boolean;
  hrDepartmentId: string | null;
  onClose: () => void;
}) => {
  const invalidate = useInvalidate();
  const [employeeId, setEmployeeId] = useState(unit.head?.employeeId ?? '');
  const [acting, setActing] = useState(unit.head?.acting ?? false);
  const locked = !isOwner && unit.id === hrDepartmentId;

  // Only active people hold a seat; the Admin account (top of the tree) never does.
  const candidates = people.filter(
    (p) => p.status === 'active' && p.reportsTo !== null && (isOwner || p.id !== meId),
  );

  const done = () => {
    invalidate();
    onClose();
  };
  const assign = useMutation({
    mutationFn: () => departmentsApi.setHead(unit.id, { employeeId, acting }),
    onSuccess: done,
  });
  const clear = useMutation({
    mutationFn: () => departmentsApi.clearHead(unit.id),
    onSuccess: done,
  });

  return (
    <Shell title={`Head of ${unit.name}`} onClose={onClose}>
      {locked ? (
        <p className='rounded-md bg-amber-50 p-3 text-sm text-amber-800'>
          This is the HR department. Its head gives the HR approval on hiring lines and offers, so
          only the Admin account sets it (Admin → Seats).
          {unit.head && ` Current head: ${unit.head.name}${unit.head.acting ? ' (acting)' : ''}.`}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            assign.mutate();
          }}
          className='space-y-4'
        >
          <p className='text-sm text-slate-600'>
            The head plans the department’s hiring and approves its JDs and scorecards. Replacing a
            head keeps the old one in the seat history.
          </p>
          <label className='block space-y-1'>
            <span className={labelClass}>Head</span>
            <select
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value=''>Choose a person…</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.designation ? ` · ${p.designation}` : ''}
                </option>
              ))}
            </select>
            {!isOwner && <p className='text-xs text-slate-500'>You can’t make yourself a head.</p>}
          </label>
          <label className='flex items-center gap-2 text-sm text-slate-700'>
            <input type='checkbox' checked={acting} onChange={(e) => setActing(e.target.checked)} />
            Acting head (standing in)
          </label>
          <ErrorLine error={assign.error ?? clear.error} />
          <div className='flex flex-wrap justify-between gap-2'>
            {unit.head ? (
              <button
                type='button'
                onClick={() => clear.mutate()}
                disabled={clear.isPending}
                className='rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50'
              >
                {clear.isPending ? 'Clearing…' : 'Leave without a head'}
              </button>
            ) : (
              <span />
            )}
            <div className='flex gap-2'>
              <button type='button' onClick={onClose} className={secondaryBtn}>
                Cancel
              </button>
              <button
                type='submit'
                disabled={
                  assign.isPending ||
                  !employeeId ||
                  (employeeId === unit.head?.employeeId && acting === unit.head?.acting)
                }
                className={primaryBtn}
              >
                {assign.isPending ? 'Saving…' : 'Save head'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Shell>
  );
};

/**
 * Who is in a unit. Home members (divisions / departments) are moved here
 * through the person's record — that DOES move their department-wide access
 * and approvals. Extra members ("also in", chapter members) are display only.
 */
export const MembersModal = ({
  unit,
  all,
  people,
  memberships,
  onClose,
}: {
  unit: Department;
  all: Department[];
  people: Employee[];
  memberships: DepartmentMembership[];
  onClose: () => void;
}) => {
  const invalidate = useInvalidate();
  const [homeId, setHomeId] = useState('');
  const [extraId, setExtraId] = useState('');
  const isChapter = unit.kind === 'chapter';
  const current = people.filter((p) => p.status !== 'inactive');
  const home = current.filter((p) => p.departmentId === unit.id);
  const extras = memberships.filter((m) => m.departmentId === unit.id);
  const extraIds = new Set(extras.map((m) => m.employeeId));
  const nameOf = (id: string | null) => (id ? (all.find((d) => d.id === id)?.name ?? null) : null);

  const moveHere = useMutation({
    mutationFn: () => employeesApi.update(homeId, { departmentId: unit.id }),
    onSuccess: () => {
      setHomeId('');
      invalidate();
    },
  });
  const addExtra = useMutation({
    mutationFn: () => departmentsApi.addMember(unit.id, extraId),
    onSuccess: () => {
      setExtraId('');
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (membershipId: string) => departmentsApi.removeMember(membershipId),
    onSuccess: invalidate,
  });
  const lead = useMutation({
    mutationFn: (employeeId: string | null) => departmentsApi.setLead(unit.id, employeeId),
    onSuccess: invalidate,
  });

  const moving = current.find((p) => p.id === homeId);

  return (
    <Shell title={`${unit.name} — members`} onClose={onClose}>
      {!isChapter && (
        <section className='space-y-2'>
          <h3 className='text-sm font-semibold text-slate-700'>
            Home members <span className='font-normal text-slate-500'>({home.length})</span>
          </h3>
          {home.length === 0 ? (
            <p className='text-sm text-slate-500'>Nobody calls this unit home yet.</p>
          ) : (
            <ul className='divide-y divide-slate-100 rounded-md border border-slate-200 text-sm'>
              {home.map((p) => (
                <li key={p.id} className='flex justify-between gap-2 px-3 py-1.5'>
                  <span className='text-slate-800'>{p.name}</span>
                  <span className='truncate text-xs text-slate-500'>{p.designation}</span>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              moveHere.mutate();
            }}
            className='flex gap-2'
          >
            <select
              aria-label='Move someone here'
              className={inputClass}
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
            >
              <option value=''>Move someone here…</option>
              {current
                .filter((p) => p.departmentId !== unit.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {nameOf(p.departmentId) ?? 'no department'}
                  </option>
                ))}
            </select>
            <button type='submit' disabled={!homeId || moveHere.isPending} className={primaryBtn}>
              Move
            </button>
          </form>
          {moving && (
            <p className='text-xs text-amber-700'>
              {moving.name}’s home moves from {nameOf(moving.departmentId) ?? 'no department'} to{' '}
              {unit.name}. Anyone with department-wide access now sees them in {unit.name} instead.
            </p>
          )}
          <ErrorLine error={moveHere.error} />
        </section>
      )}

      <section className='space-y-2'>
        <h3 className='text-sm font-semibold text-slate-700'>
          {isChapter ? 'Chapter members' : 'Also in this unit'}{' '}
          <span className='font-normal text-slate-500'>({extras.length})</span>
        </h3>
        <p className='text-xs text-slate-500'>
          {isChapter
            ? 'Members keep their home department; the chapter is for display only.'
            : 'People who also work here but belong to another home unit. Display only — access stays with their home unit.'}
        </p>
        {extras.length > 0 && (
          <ul className='divide-y divide-slate-100 rounded-md border border-slate-200 text-sm'>
            {extras.map((m) => {
              const person = current.find((p) => p.id === m.employeeId);
              return (
                <li key={m.id} className='flex items-center justify-between gap-2 px-3 py-1.5'>
                  <span className='text-slate-800'>
                    {m.employeeName}
                    {m.isLead && (
                      <span className='ml-2 rounded-full bg-violet-50 px-1.5 py-0.5 text-xs uppercase tracking-wide text-violet-700'>
                        lead
                      </span>
                    )}
                    <span className='ml-2 text-xs text-slate-500'>
                      sits in {nameOf(person?.departmentId ?? null) ?? 'no department'}
                    </span>
                  </span>
                  <span className='flex shrink-0 gap-2 text-xs'>
                    {isChapter && !m.isLead && (
                      <button
                        type='button'
                        onClick={() => lead.mutate(m.employeeId)}
                        disabled={lead.isPending}
                        className='text-brand-600 hover:underline'
                      >
                        Make lead
                      </button>
                    )}
                    {isChapter && m.isLead && (
                      <button
                        type='button'
                        onClick={() => lead.mutate(null)}
                        disabled={lead.isPending}
                        className='text-slate-500 hover:underline'
                      >
                        No lead
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => remove.mutate(m.id)}
                      disabled={remove.isPending}
                      className='text-red-600 hover:underline'
                    >
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addExtra.mutate();
          }}
          className='flex gap-2'
        >
          <select
            aria-label='Add someone'
            className={inputClass}
            value={extraId}
            onChange={(e) => setExtraId(e.target.value)}
          >
            <option value=''>
              {isChapter ? 'Add a member…' : 'Add someone who also works here…'}
            </option>
            {current
              .filter((p) => !extraIds.has(p.id) && p.departmentId !== unit.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {nameOf(p.departmentId) ?? 'no department'}
                </option>
              ))}
          </select>
          <button type='submit' disabled={!extraId || addExtra.isPending} className={primaryBtn}>
            Add
          </button>
        </form>
        <ErrorLine error={addExtra.error ?? remove.error ?? lead.error} />
      </section>

      <div className='flex justify-end'>
        <button type='button' onClick={onClose} className={secondaryBtn}>
          Done
        </button>
      </div>
    </Shell>
  );
};

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Action, Batch, Grant, Module, Scope } from '@app-types/api.types';
import {
  ACCESS_LEVELS,
  ACTION_LABELS,
  ACTION_ORDER,
  MODULE_GROUPS,
  MODULE_INFO,
  ORG_ONLY_MODULES,
  ROLE_INFO,
  SCOPE_LABELS,
  SCOPE_ORDER,
  actionsText,
  levelFor,
  moduleLabel,
  roleLabel,
} from '@constants/Common/access/modules.constants';
import { accessApi } from '@services/api/access.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';

/** One area at one "for whom": the actions ticked there. */
interface GrantRowDraft {
  moduleKey: string;
  actions: Action[];
  scope: Scope;
}

/** Collapse flat (module, action, scope) grants into one row per area + scope. */
const toRows = (grants: Grant[]): GrantRowDraft[] => {
  const rows = new Map<string, GrantRowDraft>();
  for (const g of grants) {
    const key = `${g.moduleKey}:${g.scope}`;
    const row = rows.get(key) ?? { moduleKey: g.moduleKey, actions: [], scope: g.scope };
    if (!row.actions.includes(g.action)) row.actions.push(g.action);
    rows.set(key, row);
  }
  return [...rows.values()];
};

const toGrants = (rows: GrantRowDraft[]): Grant[] =>
  rows.flatMap((r) =>
    r.actions.map((action) => ({ moduleKey: r.moduleKey, action, scope: r.scope })),
  );

/** Portal sections gate on these literal role names — renaming one would lock
 *  every member out of their screens, so the editor (and the backend) refuse. */
const PROTECTED_BATCH_NAMES = new Set(['Employee', 'HRBP', 'TA', 'PR', 'OPS']);

/** The areas to offer: the backend's module tree, with our names and groups. */
const areaList = (modules: Module[] | undefined, rows: GrantRowDraft[]) => {
  const keys = modules?.map((m) => m.key) ?? Object.keys(MODULE_INFO);
  return keys
    .filter((k) => !MODULE_INFO[k]?.hidden || rows.some((r) => r.moduleKey === k))
    .map((k) => ({
      key: k,
      label: moduleLabel(k, modules?.find((m) => m.key === k)?.name),
      group: MODULE_INFO[k]?.group ?? 'Other',
    }));
};

const selectCls = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400';

/**
 * One area in the role editor: an access level and a "for whom". A mix the
 * levels can't express (single ticks, or several "for whom"s) opens Custom,
 * the tick-box form; nothing about the stored grants changes by viewing it.
 */
const AreaRow = ({
  area,
  rows,
  onChange,
}: {
  area: { key: string; label: string };
  rows: GrantRowDraft[];
  onChange: (rows: GrantRowDraft[]) => void;
}) => {
  const [customOpen, setCustomOpen] = useState(false);
  const orgOnly = ORG_ONLY_MODULES.has(area.key);
  const simpleLevel = rows.length === 1 ? levelFor(rows[0]!.actions) : null;
  const isCustom = rows.length > 1 || (rows.length === 1 && !simpleLevel);
  const showCustom = isCustom || customOpen;
  const level = rows.length === 0 ? 'none' : (simpleLevel ?? 'custom');
  const scope = rows[0]?.scope ?? 'org';

  const setLevel = (value: string) => {
    if (value === 'custom') {
      setCustomOpen(true);
      if (rows.length === 0) onChange([{ moduleKey: area.key, actions: ['read'], scope: 'org' }]);
      return;
    }
    setCustomOpen(false);
    const picked = ACCESS_LEVELS.find((l) => l.key === value);
    onChange(picked ? [{ moduleKey: area.key, actions: [...picked.actions], scope: orgOnly ? 'org' : scope }] : []);
  };
  const setRow = (i: number, patch: Partial<GrantRowDraft>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const toggle = (i: number, action: Action) => {
    const acts = rows[i]!.actions;
    setRow(i, { actions: acts.includes(action) ? acts.filter((a) => a !== action) : [...acts, action] });
  };
  const unusedScope = SCOPE_ORDER.find((s) => !rows.some((r) => r.scope === s));
  const duplicate = rows.some((r, i) => rows.findIndex((o) => o.scope === r.scope) !== i);

  return (
    <div className='border-t border-slate-100 py-3 first:border-t-0'>
      <div className='flex flex-wrap items-start gap-3'>
        <div className='min-w-0 flex-1 basis-56'>
          <p className={`text-sm font-medium ${rows.length ? 'text-slate-800' : 'text-slate-500'}`}>
            {area.label}
          </p>
          {MODULE_INFO[area.key] && (
            <p className='mt-0.5 text-xs text-slate-400'>{MODULE_INFO[area.key]!.unlocks}</p>
          )}
        </div>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className={`${selectCls} w-44`}>
          <option value='none'>No access</option>
          {ACCESS_LEVELS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
          <option value='custom'>Custom…</option>
        </select>
        <div className='w-48'>
          {showCustom ? (
            <p className='py-1.5 text-xs text-slate-400'>Set below</p>
          ) : orgOnly ? (
            <p className='py-1.5 text-sm text-slate-500' title='This area only works company-wide'>
              {rows.length ? 'Whole company' : '—'}
            </p>
          ) : (
            <select
              value={scope}
              disabled={rows.length === 0}
              onChange={(e) => setRow(0, { scope: e.target.value as Scope })}
              className={`${selectCls} w-full`}
              title='Whose records this reaches'
            >
              {SCOPE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {showCustom && (
        <div className='mt-2 space-y-2 rounded-lg bg-slate-50 p-3'>
          {rows.map((row, i) => (
            <div key={i} className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-3'>
                {ACTION_ORDER.map((action) => (
                  <label key={action} className='flex items-center gap-1 text-xs text-slate-600'>
                    <input
                      type='checkbox'
                      checked={row.actions.includes(action)}
                      onChange={() => toggle(i, action)}
                    />
                    {ACTION_LABELS[action]}
                  </label>
                ))}
              </div>
              {orgOnly ? (
                <span className='text-xs text-slate-500'>Whole company</span>
              ) : (
                <select
                  value={row.scope}
                  onChange={(e) => setRow(i, { scope: e.target.value as Scope })}
                  className={selectCls}
                >
                  {SCOPE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {SCOPE_LABELS[s]}
                    </option>
                  ))}
                </select>
              )}
              <button
                type='button'
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                className='text-xs text-red-500 hover:text-red-700'
              >
                Remove
              </button>
              {row.actions.length === 0 && (
                <p className='basis-full text-xs text-red-600'>Tick at least one box, or remove this line.</p>
              )}
              {orgOnly && row.scope !== 'org' && (
                <p className='basis-full text-xs text-amber-700'>
                  This area only works company-wide — “{SCOPE_LABELS[row.scope]}” gives no access here.
                </p>
              )}
            </div>
          ))}
          {duplicate && (
            <p className='text-xs text-red-600'>Two lines use the same “for whom” — merge them into one.</p>
          )}
          <div className='flex flex-wrap gap-3 text-xs'>
            {!orgOnly && unusedScope && (
              <button
                type='button'
                onClick={() =>
                  onChange([...rows, { moduleKey: area.key, actions: ['read'], scope: unusedScope }])
                }
                className='text-brand-600 hover:text-brand-500'
              >
                + Different access for another group
              </button>
            )}
            {!isCustom && (
              <button
                type='button'
                onClick={() => setCustomOpen(false)}
                className='text-slate-500 hover:text-slate-700'
              >
                Back to simple
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** What the editor opens with; editingId null = create a new role. */
interface ComposerSeed {
  editingId: string | null;
  name: string;
  description: string;
  rows: GrantRowDraft[];
}

/**
 * Create/edit a role as one table of areas, grouped (learner, 2026-11-05).
 * Edits apply LIVE to every current member on their next request (§3.2) —
 * hence the member-count warning; the backend audit-logs the change in the
 * same transaction.
 */
const RoleEditor = ({ seed, onClose }: { seed: ComposerSeed; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const builtIn = seed.editingId !== null && PROTECTED_BATCH_NAMES.has(seed.name);
  const [name, setName] = useState(seed.name);
  const [description, setDescription] = useState(seed.description);
  const [rows, setRows] = useState<GrantRowDraft[]>(seed.rows);

  const { data: modules } = useQuery({ queryKey: ['access-modules'], queryFn: accessApi.listModules });
  const { data: holders } = useQuery({
    queryKey: ['batch-holders', seed.editingId],
    queryFn: () => accessApi.listBatchHolders(seed.editingId!),
    enabled: seed.editingId !== null,
  });

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), description: description.trim() || undefined, grants: toGrants(rows) };
      return seed.editingId ? accessApi.updateBatch(seed.editingId, input) : accessApi.createBatch(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      onClose();
    },
  });

  const areas = areaList(modules, rows);
  const setArea = (key: string, next: GrantRowDraft[]) =>
    setRows((prev) => [...prev.filter((r) => r.moduleKey !== key), ...next]);

  const duplicate = rows.some(
    (r, i) => rows.findIndex((o) => o.moduleKey === r.moduleKey && o.scope === r.scope) !== i,
  );
  const areaCount = new Set(rows.map((r) => r.moduleKey)).size;
  const invalid =
    !name.trim() || rows.length === 0 || rows.some((r) => r.actions.length === 0) || duplicate;

  return (
    <div className='rounded-xl border border-brand-200 bg-white p-5'>
      <h2 className='text-lg font-semibold text-slate-800'>
        {seed.editingId ? `Edit role: ${roleLabel(seed.name)}` : 'New role'}
      </h2>
      {seed.editingId && (
        <p className='mt-1 text-sm text-amber-600'>
          Changes apply straight away to the {holders?.length ?? '…'}{' '}
          {holders?.length === 1 ? 'person' : 'people'} in this role.
        </p>
      )}

      <div className='mt-3 grid gap-3 sm:grid-cols-2'>
        <input
          value={builtIn ? roleLabel(name) : name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Role name (e.g. HR — leave only)'
          disabled={builtIn}
          title={builtIn ? 'Built-in roles can’t be renamed — the menus depend on them' : undefined}
          className='rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500'
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Who it’s for (optional)'
          className='rounded-md border border-slate-300 px-3 py-2 text-sm'
        />
      </div>

      <div className='mt-4 hidden gap-3 px-1 text-xs font-medium uppercase tracking-wide text-slate-400 sm:flex'>
        <span className='flex-1'>Area</span>
        <span className='w-44'>Access</span>
        <span className='w-48'>For whom</span>
      </div>
      <div className='mt-1 space-y-4'>
        {MODULE_GROUPS.map((group) => {
          const inGroup = areas.filter((a) => a.group === group);
          if (inGroup.length === 0) return null;
          return (
            <section key={group} className='rounded-lg border border-slate-200 px-4 py-1'>
              <h3 className='pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>{group}</h3>
              {inGroup.map((a) => (
                <AreaRow
                  key={a.key}
                  area={a}
                  rows={rows.filter((r) => r.moduleKey === a.key)}
                  onChange={(next) => setArea(a.key, next)}
                />
              ))}
            </section>
          );
        })}
      </div>

      {save.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}

      <div className='mt-4 flex flex-wrap items-center gap-2'>
        <button
          type='button'
          disabled={invalid || save.isPending}
          onClick={() => save.mutate()}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
        >
          {save.isPending ? 'Saving…' : seed.editingId ? 'Save changes' : 'Create role'}
        </button>
        <button
          type='button'
          onClick={onClose}
          className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
        >
          Cancel
        </button>
        <span className='text-xs text-slate-400'>
          {areaCount === 0 ? 'Give access to at least one area.' : `${areaCount} area${areaCount === 1 ? '' : 's'} with access.`}
        </span>
      </div>
    </div>
  );
};

/** A role's access in plain sentences, one line per area. */
const AccessSummary = ({ grants, modules }: { grants: Grant[]; modules: Module[] | undefined }) => {
  const [open, setOpen] = useState(false);
  const rows = toRows(grants);
  const keys = [...new Set(rows.map((r) => r.moduleKey))];
  if (keys.length === 0) return <p className='text-xs text-slate-400'>This role gives no access yet.</p>;
  return (
    <div className='space-y-1.5'>
      <ul className='space-y-1 text-sm text-slate-700'>
        {keys.map((k) => (
          <li key={k}>
            <span className='font-medium'>{moduleLabel(k, modules?.find((m) => m.key === k)?.name)}</span>
            <span className='text-slate-500'>
              {' — '}
              {rows
                .filter((r) => r.moduleKey === k)
                .map((r) => `${actionsText(r.actions)} · ${SCOPE_LABELS[r.scope].toLowerCase()}`)
                .join('; ')}
            </span>
            {open && MODULE_INFO[k] && (
              <span className='block text-xs text-slate-400'>{MODULE_INFO[k]!.unlocks}</span>
            )}
          </li>
        ))}
      </ul>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='text-xs text-brand-600 hover:text-brand-500'
      >
        {open ? 'Hide details' : 'What this lets them do'}
      </button>
    </div>
  );
};

/**
 * One role's card: what it gives, who is in it, add / take away. Changes apply
 * on the person's next request — the backend resolves access per request,
 * never from the token (§10). Nobody changes their own access (server-side);
 * the audit log records every change.
 */
const RoleCard = ({ batch, onEdit, onDuplicate }: {
  batch: Batch;
  onEdit: (batch: Batch) => void;
  onDuplicate: (batch: Batch) => void;
}) => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');

  const { data: holders, isLoading } = useQuery({
    queryKey: ['batch-holders', batch.id],
    queryFn: () => accessApi.listBatchHolders(batch.id),
  });
  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const { data: modules } = useQuery({ queryKey: ['access-modules'], queryFn: accessApi.listModules });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['batch-holders', batch.id] });

  const assign = useMutation({
    mutationFn: (employeeId: string) => accessApi.assignBatch(batch.id, employeeId),
    onSuccess: () => {
      setSelected('');
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (employeeId: string) => accessApi.revokeBatch(batch.id, employeeId),
    onSuccess: refresh,
  });

  const holderIds = new Set((holders ?? []).map((h) => h.employeeId));
  const assignable = (employees ?? []).filter((e) => e.status !== 'inactive' && !holderIds.has(e.id));
  const builtIn = ROLE_INFO[batch.name];

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex flex-wrap items-baseline justify-between gap-3'>
        <h2 className='text-lg font-semibold text-slate-800'>
          {roleLabel(batch.name)}
          {builtIn && (
            <span className='ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-normal text-slate-500'>
              built-in
            </span>
          )}
        </h2>
        <span className='flex items-baseline gap-3 text-xs'>
          <button type='button' onClick={() => onEdit(batch)} className='text-brand-600 hover:text-brand-500'>
            Edit
          </button>
          <button type='button' onClick={() => onDuplicate(batch)} className='text-brand-600 hover:text-brand-500'>
            Duplicate
          </button>
        </span>
      </div>
      {(builtIn?.blurb ?? batch.description) && (
        <p className='mt-1 text-sm text-slate-500'>{builtIn?.blurb ?? batch.description}</p>
      )}

      <div className='mt-3'>
        <AccessSummary grants={batch.grants} modules={modules} />
      </div>

      <div className='mt-4 border-t border-slate-100 pt-3'>
        <p className='text-xs font-medium text-slate-500'>
          People in this role ({holders?.length ?? '…'})
        </p>
        {isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {(holders ?? []).map((h) => (
          <div key={h.employeeId} className='flex items-center justify-between py-1.5 text-sm'>
            <span className='text-slate-700'>
              {h.name} <span className='text-slate-400'>— {h.employeeCode}</span>
            </span>
            <button
              type='button'
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(h.employeeId)}
              className='text-xs text-red-500 hover:text-red-700 disabled:opacity-50'
            >
              Take away
            </button>
          </div>
        ))}
        {holders?.length === 0 && <p className='py-1.5 text-sm text-slate-400'>Nobody has this role yet.</p>}

        <div className='mt-2 flex gap-2'>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value=''>Give this role to…</option>
            {assignable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.employeeCode}
              </option>
            ))}
          </select>
          <button
            type='button'
            disabled={!selected || assign.isPending}
            onClick={() => assign.mutate(selected)}
            className='shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {assign.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
        {(assign.error || revoke.error) && (
          <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(assign.error ?? revoke.error)}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Roles & access (§3.2; was "Access batches" — renamed for Admin / HR readers,
 * learner 2026-11-05). Stored as batches; only the screen words changed.
 */
const BatchesPage = () => {
  const [seed, setSeed] = useState<ComposerSeed | null>(null);
  // Remount the editor each time it opens so its state resets to the seed.
  const [seedVersion, setSeedVersion] = useState(0);
  const openEditor = (next: ComposerSeed) => {
    setSeed(next);
    setSeedVersion((v) => v + 1);
  };

  const { data: batches, isLoading, error } = useQuery({ queryKey: ['batches'], queryFn: accessApi.listBatches });

  if (isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (error) return <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>;

  // Built-in roles first, in a fixed order; custom roles after, by name.
  const order = Object.keys(ROLE_INFO);
  const sorted = [...(batches ?? [])].sort((a, b) => {
    const ia = order.indexOf(a.name);
    const ib = order.indexOf(b.name);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Roles &amp; access</h1>
        <button
          type='button'
          onClick={() => openEditor({ editingId: null, name: '', description: '', rows: [] })}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
        >
          New role
        </button>
      </div>
      <p className='text-sm text-slate-500'>
        A role is a set of things people can see and do. Give someone a role and it applies the next
        time they use the app; changing a role changes it for everyone in it. Every change is recorded
        in the audit log. For a slightly different version of a role, use <b>Duplicate</b> and adjust it.
      </p>

      {seed && <RoleEditor key={seedVersion} seed={seed} onClose={() => setSeed(null)} />}

      <div className='grid gap-4 lg:grid-cols-2'>
        {sorted.map((batch) => (
          <RoleCard
            key={batch.id}
            batch={batch}
            onEdit={(b) =>
              openEditor({
                editingId: b.id,
                name: b.name,
                description: b.description ?? '',
                rows: toRows(b.grants),
              })
            }
            onDuplicate={(b) =>
              openEditor({
                editingId: null,
                name: `${roleLabel(b.name)} (copy)`,
                description: b.description ?? '',
                rows: toRows(b.grants),
              })
            }
          />
        ))}
      </div>
    </div>
  );
};

export default BatchesPage;

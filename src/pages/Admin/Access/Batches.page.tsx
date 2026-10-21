import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Action, Batch, Grant, Scope } from '@app-types/api.types';
import {
  ORG_ONLY_MODULES,
  MODULE_GROUPS,
  MODULE_INFO,
  RIGHTS_PRESETS,
  SCOPE_LABELS,
  SCOPE_ORDER,
  presetFor,
} from '@constants/Common/access/modules.constants';
import { accessApi } from '@services/api/access.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';

const ACTIONS: Action[] = ['create', 'read', 'update', 'delete'];

/** A module's readable name: the seeded name, else its key. */
const moduleLabel = (key: string, modules: { key: string; name: string }[] | undefined) =>
  modules?.find((m) => m.key === key)?.name ?? key;

/** One composer row: a module with its ticked actions at one scope. */
interface GrantRowDraft {
  moduleKey: string;
  actions: Action[];
  scope: Scope;
}

/** Collapse flat (module, action, scope) grants into one row per module+scope. */
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

/** Portal sections gate on these literal batch names — renaming one would lock
 *  every holder out of their UI, so the composer (and the backend) refuse. */
const PROTECTED_BATCH_NAMES = new Set(['Employee', 'HRBP', 'TA', 'PR', 'OPS']);

/** What the composer opens with; editingId null = create a new batch. */
interface ComposerSeed {
  editingId: string | null;
  name: string;
  description: string;
  rows: GrantRowDraft[];
}

/**
 * Create/edit a batch as rows of module × actions × scope. Edits apply LIVE to
 * every current holder on their next request (§3.2) — hence the holder-count
 * warning; the backend audit-logs the change in the same transaction.
 */
const BatchComposer = ({ seed, onClose }: { seed: ComposerSeed; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(seed.name);
  const [description, setDescription] = useState(seed.description);
  const [rows, setRows] = useState<GrantRowDraft[]>(seed.rows);

  const { data: modules } = useQuery({
    queryKey: ['access-modules'],
    queryFn: accessApi.listModules,
  });
  const { data: holders } = useQuery({
    queryKey: ['batch-holders', seed.editingId],
    queryFn: () => accessApi.listBatchHolders(seed.editingId!),
    enabled: seed.editingId !== null,
  });

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), description: description.trim() || undefined, grants: toGrants(rows) };
      return seed.editingId
        ? accessApi.updateBatch(seed.editingId, input)
        : accessApi.createBatch(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      onClose();
    },
  });

  const setRow = (i: number, patch: Partial<GrantRowDraft>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const toggleAction = (i: number, action: Action) => {
    const row = rows[i];
    setRow(i, {
      actions: row.actions.includes(action)
        ? row.actions.filter((a) => a !== action)
        : [...row.actions, action],
    });
  };

  const duplicateModules = rows.some(
    (r, i) => rows.findIndex((o) => o.moduleKey === r.moduleKey && o.scope === r.scope) !== i,
  );
  const invalid =
    !name.trim() ||
    rows.length === 0 ||
    rows.some((r) => !r.moduleKey || r.actions.length === 0) ||
    duplicateModules;

  return (
    <div className='rounded-xl border border-brand-200 bg-white p-5'>
      <h2 className='text-lg font-semibold text-slate-800'>
        {seed.editingId ? 'Edit batch' : 'New batch'}
      </h2>
      {seed.editingId && (
        <p className='mt-1 text-sm text-amber-600'>
          Changes apply immediately to {holders?.length ?? '…'} current holder
          {holders?.length === 1 ? '' : 's'}.
        </p>
      )}

      <div className='mt-3 grid gap-3 sm:grid-cols-2'>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Batch name (e.g. HR – Career & PR)'
          disabled={seed.editingId !== null && PROTECTED_BATCH_NAMES.has(seed.name)}
          title={
            seed.editingId !== null && PROTECTED_BATCH_NAMES.has(seed.name)
              ? 'Seeded batches cannot be renamed — the portal gates on their names'
              : undefined
          }
          className='rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400'
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Description (optional)'
          className='rounded-md border border-slate-300 px-3 py-2 text-sm'
        />
      </div>

      <div className='mt-4 space-y-2'>
        {rows.map((row, i) => (
          <div
            key={i}
            className='flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2'
          >
            <select
              value={row.moduleKey}
              onChange={(e) => setRow(i, { moduleKey: e.target.value })}
              className='rounded-md border border-slate-300 px-2 py-1.5 text-sm'
            >
              <option value=''>Module…</option>
              {MODULE_GROUPS.map((group) => {
                const inGroup = (modules ?? []).filter(
                  (m) => (MODULE_INFO[m.key]?.group ?? 'Other') === group,
                );
                if (inGroup.length === 0) return null;
                return (
                  <optgroup key={group} label={group}>
                    {inGroup.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                        {MODULE_INFO[m.key]?.notBuilt ? ' (not built yet)' : ''} — {m.key}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <div className='flex items-center gap-2.5'>
              {ACTIONS.map((action) => (
                <label key={action} className='flex items-center gap-1 text-xs text-slate-600'>
                  <input
                    type='checkbox'
                    checked={row.actions.includes(action)}
                    onChange={() => toggleAction(i, action)}
                  />
                  {action}
                </label>
              ))}
            </div>
            <select
              value={row.scope}
              onChange={(e) => setRow(i, { scope: e.target.value as Scope })}
              className='rounded-md border border-slate-300 px-2 py-1.5 text-sm'
            >
              {SCOPE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
            <label className='flex items-center gap-1 text-xs text-slate-500'>
              Preset
              <select
                value={presetFor(row.actions) ?? 'custom'}
                onChange={(e) => {
                  const preset = RIGHTS_PRESETS[e.target.value];
                  if (preset) setRow(i, { actions: [...preset] });
                }}
                title='A shortcut that ticks the boxes. Only the ticked boxes are saved.'
                className='rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600'
              >
                {Object.entries(RIGHTS_PRESETS).map(([name, acts]) => (
                  <option key={name} value={name}>
                    {name} ({acts.join(', ')})
                  </option>
                ))}
                <option value='custom' disabled>
                  custom
                </option>
              </select>
            </label>
            <button
              type='button'
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              className='ml-auto text-xs text-red-500 hover:text-red-700'
            >
              Remove
            </button>
            {row.moduleKey && MODULE_INFO[row.moduleKey] && (
              <p className='basis-full text-xs text-slate-500'>
                Unlocks: {MODULE_INFO[row.moduleKey]!.unlocks}
              </p>
            )}
            {row.scope !== 'org' && ORG_ONLY_MODULES.has(row.moduleKey) && (
              <p className='basis-full text-xs text-amber-700'>
                This module is company-wide: only an org grant opens it. With “{row.scope}” the
                members get no access here.
              </p>
            )}
            {row.scope !== 'org' && !ORG_ONLY_MODULES.has(row.moduleKey) && row.moduleKey && (
              <p className='basis-full text-xs text-slate-500'>
                Members see and act only on {SCOPE_LABELS[row.scope].split('— ')[1]} (plus
                themselves).
              </p>
            )}
          </div>
        ))}
        <button
          type='button'
          onClick={() => setRows([...rows, { moduleKey: '', actions: ['read'], scope: 'org' }])}
          className='rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50'
        >
          + Add module
        </button>
      </div>

      {duplicateModules && (
        <p className='mt-2 text-sm text-red-600'>
          Two rows grant the same module at the same scope — merge them into one.
        </p>
      )}
      {save.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}

      <div className='mt-4 flex gap-2'>
        <button
          type='button'
          disabled={invalid || save.isPending}
          onClick={() => save.mutate()}
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
        >
          {save.isPending ? 'Saving…' : seed.editingId ? 'Save changes' : 'Create batch'}
        </button>
        <button
          type='button'
          onClick={onClose}
          className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * One batch's card: grants, current holders, assign/revoke. Assignment and
 * revocation apply on the holder's next request — the backend resolves grants
 * per request, never from the token (§10). Self-assign/revoke is blocked
 * server-side (no self-approval); the audit log records every change.
 */
const BatchCard = ({ batch, onEdit, onDuplicate }: {
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
  const { data: modules } = useQuery({
    queryKey: ['access-modules'],
    queryFn: accessApi.listModules,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['batch-holders', batch.id] });

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
  const assignable = (employees ?? []).filter(
    (e) => e.status !== 'inactive' && !holderIds.has(e.id),
  );

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='text-lg font-semibold text-slate-800'>{batch.name}</h2>
        <span className='flex items-baseline gap-3 text-xs'>
          <button
            type='button'
            onClick={() => onEdit(batch)}
            className='text-brand-600 hover:text-brand-500'
          >
            Edit
          </button>
          <button
            type='button'
            onClick={() => onDuplicate(batch)}
            className='text-brand-600 hover:text-brand-500'
          >
            Duplicate
          </button>
          <span className='text-slate-400'>
            {holders?.length ?? '…'} holder{holders?.length === 1 ? '' : 's'}
          </span>
        </span>
      </div>
      {batch.description && <p className='mt-1 text-sm text-slate-500'>{batch.description}</p>}

      <div className='mt-3 flex flex-wrap gap-1.5'>
        {batch.grants.map((g) => (
          <span
            key={`${g.moduleKey}:${g.action}:${g.scope}`}
            className='rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-900'
          >
            {moduleLabel(g.moduleKey, modules)} · {g.action} · {g.scope}
          </span>
        ))}
        {batch.grants.length === 0 && (
          <span className='text-xs text-slate-400'>No grants in this batch.</span>
        )}
      </div>

      <div className='mt-4 border-t border-slate-100 pt-3'>
        {isLoading && <p className='text-sm text-slate-500'>Loading holders…</p>}
        {(holders ?? []).map((h) => (
          <div
            key={h.employeeId}
            className='flex items-center justify-between py-1.5 text-sm'
          >
            <span className='text-slate-700'>
              {h.name} <span className='text-slate-400'>— {h.employeeCode}</span>
            </span>
            <button
              type='button'
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(h.employeeId)}
              className='text-xs text-red-500 hover:text-red-700 disabled:opacity-50'
            >
              Revoke
            </button>
          </div>
        ))}
        {holders?.length === 0 && (
          <p className='py-1.5 text-sm text-slate-400'>Nobody holds this batch yet.</p>
        )}

        <div className='mt-2 flex gap-2'>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
          >
            <option value=''>Assign to…</option>
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
            {assign.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
        {(assign.error || revoke.error) && (
          <p className='mt-2 text-sm text-red-600'>
            {apiErrorMessage(assign.error ?? revoke.error)}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Admin surface for batches (§3.2): who holds what, assign and revoke — plus
 * the composer for creating/editing custom batches (e.g. an HRBP-like batch
 * without people-create for someone who must not add employees).
 */
const BatchesPage = () => {
  const [seed, setSeed] = useState<ComposerSeed | null>(null);
  // Remount the composer each time it opens so its state resets to the seed.
  const [seedVersion, setSeedVersion] = useState(0);
  const openComposer = (next: ComposerSeed) => {
    setSeed(next);
    setSeedVersion((v) => v + 1);
  };

  const {
    data: batches,
    isLoading,
    error,
  } = useQuery({ queryKey: ['batches'], queryFn: accessApi.listBatches });

  if (isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (error) return <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>;

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Access batches</h1>
        <button
          type='button'
          onClick={() =>
            openComposer({ editingId: null, name: '', description: '', rows: [] })
          }
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
        >
          New batch
        </button>
      </div>
      <p className='text-sm text-slate-500'>
        Named bundles of (module · action · scope) grants. Changes apply on the holder&apos;s
        next request and every assignment or revocation is audit-logged. Duplicate a batch
        to hand someone a variant — e.g. HRBP without the create action on hrbp.people.
      </p>

      {seed && (
        <BatchComposer key={seedVersion} seed={seed} onClose={() => setSeed(null)} />
      )}

      <div className='grid gap-4 lg:grid-cols-2'>
        {(batches ?? []).map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            onEdit={(b) =>
              openComposer({
                editingId: b.id,
                name: b.name,
                description: b.description ?? '',
                rows: toRows(b.grants),
              })
            }
            onDuplicate={(b) =>
              openComposer({
                editingId: null,
                name: `${b.name} (copy)`,
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

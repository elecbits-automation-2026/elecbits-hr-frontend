import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AssetSetup } from '@app-types/api.types';
import { inputClass, primaryBtn, secondaryBtn } from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';

type Category = AssetSetup['categories'][number];
type Draft = {
  name: string;
  codePrefix: string;
  kind: 'equipment' | 'lab';
  requiresGatePass: boolean;
};

const blank: Draft = { name: '', codePrefix: '', kind: 'equipment', requiresGatePass: false };

/** One category row, or the add row (no `cat`). */
const CategoryRow = ({ cat, onSaved }: { cat?: Category; onSaved: (s: AssetSetup) => void }) => {
  const [editing, setEditing] = useState(!cat);
  const [d, setD] = useState<Draft>(cat ?? blank);
  const save = useMutation({
    mutationFn: () => (cat ? opsApi.updateCategory(cat.id, d) : opsApi.createCategory(d)),
    onSuccess: (s) => {
      onSaved(s);
      if (cat) setEditing(false);
      else setD(blank);
    },
  });

  if (!editing && cat) {
    return (
      <tr className='border-b border-slate-100'>
        <td className='py-2 pr-3 text-slate-800'>{cat.name}</td>
        <td className='py-2 pr-3 font-mono text-xs text-slate-500'>EB-{cat.codePrefix}-</td>
        <td className='py-2 pr-3 text-slate-600'>
          {cat.kind === 'lab' ? 'Lent (due date)' : 'Issued'}
        </td>
        <td className='py-2 pr-3 text-slate-600'>{cat.requiresGatePass ? 'Yes' : 'No'}</td>
        <td className='py-2 pr-3 text-slate-500'>{cat.assetCount}</td>
        <td className='py-2 text-right'>
          <button
            type='button'
            onClick={() => setEditing(true)}
            className='text-xs text-brand-700 hover:underline'
          >
            Edit
          </button>
        </td>
      </tr>
    );
  }
  return (
    <tr className='border-b border-slate-100 align-top'>
      <td className='py-2 pr-2'>
        <input
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder='Category name'
          className={inputClass}
        />
      </td>
      <td className='py-2 pr-2'>
        <input
          value={d.codePrefix}
          onChange={(e) => setD({ ...d, codePrefix: e.target.value.toUpperCase() })}
          placeholder='LAP'
          maxLength={6}
          className={`${inputClass} w-24 font-mono`}
        />
      </td>
      <td className='py-2 pr-2'>
        <select
          value={d.kind}
          onChange={(e) => setD({ ...d, kind: e.target.value as Draft['kind'] })}
          className={inputClass}
        >
          <option value='equipment'>Issued</option>
          <option value='lab'>Lent (due date)</option>
        </select>
      </td>
      <td className='py-2 pr-2'>
        <label className='flex items-center gap-2 pt-2 text-sm text-slate-600'>
          <input
            type='checkbox'
            checked={d.requiresGatePass}
            onChange={(e) => setD({ ...d, requiresGatePass: e.target.checked })}
          />
          Gate pass
        </label>
      </td>
      <td />
      <td className='space-y-1 py-2 text-right'>
        <div className='flex justify-end gap-1'>
          {cat && (
            <button type='button' onClick={() => setEditing(false)} className={secondaryBtn}>
              Cancel
            </button>
          )}
          <button
            type='button'
            disabled={d.name.trim().length < 2 || d.codePrefix.length < 2 || save.isPending}
            onClick={() => save.mutate()}
            className={primaryBtn}
          >
            {cat ? 'Save' : 'Add'}
          </button>
        </div>
        {save.error && <p className='text-xs text-red-600'>{apiErrorMessage(save.error)}</p>}
      </td>
    </tr>
  );
};

/** What one designation should be handed when they join. */
const KitEditor = ({ setup, onSaved }: { setup: AssetSetup; onSaved: (s: AssetSetup) => void }) => {
  const [designation, setDesignation] = useState('');
  const existing = setup.kits.find(
    (k) => k.designation.toLowerCase() === designation.toLowerCase(),
  );
  const [lines, setLines] = useState<Record<string, number>>({});
  const pick = (d: string) => {
    setDesignation(d);
    const kit = setup.kits.find((k) => k.designation.toLowerCase() === d.toLowerCase());
    setLines(Object.fromEntries((kit?.items ?? []).map((i) => [i.categoryId, i.qty])));
  };
  const save = useMutation({
    mutationFn: () =>
      opsApi.putKit({
        designation: designation.trim(),
        items: Object.entries(lines)
          .filter(([, q]) => q > 0)
          .map(([categoryId, qty]) => ({ categoryId, qty })),
      }),
    onSuccess: onSaved,
  });
  const designations = [
    ...new Set([...setup.designations, ...setup.kits.map((k) => k.designation)]),
  ].sort();

  return (
    <div className='space-y-3'>
      {setup.kits.length > 0 && (
        <ul className='space-y-1 text-sm'>
          {setup.kits.map((k) => (
            <li key={k.designation}>
              <button
                type='button'
                onClick={() => pick(k.designation)}
                className='text-left hover:underline'
              >
                <b className='text-slate-700'>{k.designation}</b>
                <span className='text-slate-500'>
                  {' '}
                  —{' '}
                  {k.items
                    .map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.categoryName}`)
                    .join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className='flex flex-wrap gap-2'>
        <input
          list='ops-designations'
          value={designation}
          onChange={(e) => pick(e.target.value)}
          placeholder='Designation, e.g. Hardware Engineer'
          className={`${inputClass} max-w-sm`}
        />
        <datalist id='ops-designations'>
          {designations.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>
      {designation.trim() && (
        <div className='space-y-2'>
          <div className='grid gap-2 sm:grid-cols-3'>
            {setup.categories.map((c) => (
              <label
                key={c.id}
                className='flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm'
              >
                <span className='text-slate-700'>{c.name}</span>
                <input
                  type='number'
                  min={0}
                  max={20}
                  value={lines[c.id] ?? 0}
                  onChange={(e) => setLines({ ...lines, [c.id]: Number(e.target.value) })}
                  className='w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm'
                />
              </label>
            ))}
          </div>
          {save.error && <p className='text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
          <div className='flex justify-end'>
            <button
              type='button'
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className={primaryBtn}
            >
              {existing ? `Save kit for ${designation}` : `Create kit for ${designation}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * OPS setup: asset categories (lent or issued, and whether they may leave on
 * a gate pass), joiner kits by designation, and the return-reminder setting.
 * Locations are the punch zones Admin manages.
 */
const OpsSetupPage = () => {
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ['ops-setup'], queryFn: opsApi.setup });
  const saved = (s: AssetSetup) => {
    queryClient.setQueryData(['ops-setup'], s);
    queryClient.invalidateQueries({ queryKey: ['ops-options'] });
  };

  return (
    <div className='w-full max-w-5xl space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>OPS setup</h1>
        <p className='text-sm text-slate-500'>
          Locations are the punch zones (Admin → Punch zones). Here: what kinds of assets exist,
          what each role gets when they join, and how overdue returns are chased.
        </p>
      </div>
      {setup.error && <p className='text-sm text-red-600'>{apiErrorMessage(setup.error)}</p>}

      {setup.data && (
        <section className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
          <h2 className='text-sm font-semibold text-slate-700'>Categories</h2>
          <p className='text-xs text-slate-500'>
            Lent categories need a due date when handed out and are chased when overdue. Only
            gate-pass categories can be taken out of a zone (never laptops).
          </p>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-xs text-slate-500'>
                  <th className='py-2 pr-3 font-medium'>Name</th>
                  <th className='py-2 pr-3 font-medium'>Tag</th>
                  <th className='py-2 pr-3 font-medium'>Handed out as</th>
                  <th className='py-2 pr-3 font-medium'>Gate pass</th>
                  <th className='py-2 pr-3 font-medium'>Assets</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {setup.data.categories.map((c) => (
                  <CategoryRow
                    key={`${c.id}:${c.name}:${c.codePrefix}:${c.kind}:${c.requiresGatePass}`}
                    cat={c}
                    onSaved={saved}
                  />
                ))}
                <CategoryRow onSaved={saved} />
              </tbody>
            </table>
          </div>
        </section>
      )}

      {setup.data && (
        <section className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
          <h2 className='text-sm font-semibold text-slate-700'>Joiner kits</h2>
          <p className='text-xs text-slate-500'>
            What a designation should be given on day one. It shows as a checklist on the person's
            sheet — nothing is issued automatically.
          </p>
          <KitEditor setup={setup.data} onSaved={saved} />
        </section>
      )}
    </div>
  );
};

export default OpsSetupPage;

import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { Asset, AssetCondition, AssetInput, AssetOptions } from '@app-types/api.types';
import {
  CONDITION_LABELS,
  inputClass,
  opsToday,
  primaryBtn,
  secondaryBtn,
} from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className='block space-y-1'>
    <span className='text-xs font-medium text-slate-600'>{label}</span>
    {children}
  </label>
);

const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

/**
 * Register a new asset, or edit one's details. A new asset can be handed to
 * someone straight away (how an existing allocation is brought in); after
 * that, custody only changes through the drawer's actions.
 */
const AssetForm = ({
  options,
  asset,
  onSaved,
  onCancel,
}: {
  options: AssetOptions;
  asset?: Asset;
  onSaved: (a: Asset) => void;
  onCancel: () => void;
}) => {
  const editing = !!asset;
  const [f, setF] = useState({
    assetCode: asset?.assetCode ?? '',
    name: asset?.name ?? '',
    categoryId: asset?.category.id ?? options.categories[0]?.id ?? '',
    zoneId: asset?.zone.id ?? options.zones[0]?.id ?? '',
    status: 'idle' as 'idle' | 'in_use_shared' | 'needs_repair',
    holderId: '',
    loanDueOn: '',
    make: asset?.make ?? '',
    model: asset?.model ?? '',
    serialNo: asset?.serialNo ?? '',
    purchasedOn: asset?.purchasedOn ?? '',
    purchaseCost: asset?.purchaseCost?.toString() ?? '',
    vendor: asset?.vendor ?? '',
    warrantyUntil: asset?.warrantyUntil ?? '',
    condition: (asset?.condition ?? 'good') as AssetCondition,
    notes: asset?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const category = options.categories.find((c) => c.id === f.categoryId);

  const save = useMutation({
    mutationFn: () => {
      const details: Partial<AssetInput> = {
        name: f.name.trim(),
        categoryId: f.categoryId,
        make: orNull(f.make),
        model: orNull(f.model),
        serialNo: orNull(f.serialNo),
        purchasedOn: orNull(f.purchasedOn),
        purchaseCost: f.purchaseCost.trim() === '' ? null : Number(f.purchaseCost),
        vendor: orNull(f.vendor),
        warrantyUntil: orNull(f.warrantyUntil),
        condition: f.condition,
        notes: orNull(f.notes),
      };
      if (editing) {
        return opsApi.updateAsset(asset.id, {
          ...details,
          ...(f.assetCode.trim() && f.assetCode.trim() !== asset.assetCode
            ? { assetCode: f.assetCode.trim() }
            : {}),
        });
      }
      return opsApi.createAsset({
        ...(details as AssetInput),
        zoneId: f.zoneId,
        ...(f.assetCode.trim() ? { assetCode: f.assetCode.trim() } : {}),
        ...(f.holderId
          ? {
              holderId: f.holderId,
              ...(category?.kind === 'lab' ? { loanDueOn: f.loanDueOn } : {}),
            }
          : { status: f.status }),
      });
    },
    onSuccess: onSaved,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <form onSubmit={submit} className='space-y-3'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <Field label='Name'>
          <input
            required
            value={f.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder='ThinkPad E14 Gen 5'
            className={inputClass}
          />
        </Field>
        <Field label='Asset tag'>
          <input
            value={f.assetCode}
            onChange={(e) => set('assetCode')(e.target.value)}
            placeholder={editing ? '' : `Blank = next EB-${category?.codePrefix ?? 'XXX'}-0001`}
            className={inputClass}
          />
        </Field>
        <Field label='Category'>
          <select
            value={f.categoryId}
            onChange={(e) => set('categoryId')(e.target.value)}
            className={inputClass}
          >
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.kind === 'lab' ? ' (lent)' : ''}
                {c.requiresGatePass ? ' · gate pass' : ''}
              </option>
            ))}
          </select>
        </Field>
        {!editing && (
          <Field label='Zone'>
            <select
              value={f.zoneId}
              onChange={(e) => set('zoneId')(e.target.value)}
              className={inputClass}
            >
              {options.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!editing && (
          <Field label='Held by (optional)'>
            <select
              value={f.holderId}
              onChange={(e) => set('holderId')(e.target.value)}
              className={inputClass}
            >
              <option value=''>Nobody — it belongs to the zone</option>
              {options.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.designation ? ` · ${p.designation}` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!editing && !f.holderId && (
          <Field label='Status'>
            <select
              value={f.status}
              onChange={(e) => set('status')(e.target.value)}
              className={inputClass}
            >
              <option value='idle'>Idle</option>
              <option value='in_use_shared'>In use (shared — router, printer…)</option>
              <option value='needs_repair'>Needs repair</option>
            </select>
          </Field>
        )}
        {!editing && f.holderId && category?.kind === 'lab' && (
          <Field label='Due back on'>
            <input
              required
              type='date'
              min={opsToday()}
              value={f.loanDueOn}
              onChange={(e) => set('loanDueOn')(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
        <Field label='Make'>
          <input
            value={f.make}
            onChange={(e) => set('make')(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label='Model'>
          <input
            value={f.model}
            onChange={(e) => set('model')(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label='Serial number'>
          <input
            value={f.serialNo}
            onChange={(e) => set('serialNo')(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label='Condition'>
          <select
            value={f.condition}
            onChange={(e) => set('condition')(e.target.value)}
            className={inputClass}
          >
            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label='Purchased on'>
          <input
            type='date'
            value={f.purchasedOn}
            onChange={(e) => set('purchasedOn')(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label='Purchase cost (₹)'>
          <input
            type='number'
            min={0}
            step='0.01'
            value={f.purchaseCost}
            onChange={(e) => set('purchaseCost')(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label='Vendor'>
          <input
            value={f.vendor}
            onChange={(e) => set('vendor')(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label='Warranty until'>
          <input
            type='date'
            value={f.warrantyUntil}
            onChange={(e) => set('warrantyUntil')(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label='Notes'>
        <textarea
          rows={2}
          value={f.notes}
          onChange={(e) => set('notes')(e.target.value)}
          className={inputClass}
        />
      </Field>
      {save.error && <p className='text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button type='button' onClick={onCancel} className={secondaryBtn}>
          Cancel
        </button>
        <button type='submit' disabled={save.isPending} className={primaryBtn}>
          {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add asset'}
        </button>
      </div>
    </form>
  );
};

export default AssetForm;

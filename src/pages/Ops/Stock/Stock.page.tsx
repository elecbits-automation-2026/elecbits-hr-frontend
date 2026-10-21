import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { StockMoveInput, StockOverview } from '@app-types/api.types';
import {
  STOCK_KIND_LABELS,
  fmtWhen,
  inputClass,
  primaryBtn,
  secondaryBtn,
} from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';

const MOVE_LABELS: Record<StockMoveInput['kind'], string> = {
  in: 'Stock in',
  issue: 'Issue to a person',
  transfer: 'Transfer to another zone',
  adjust: 'Adjust after a count',
};

/** Record one stock move. */
const MoveForm = ({
  data,
  people,
  onDone,
}: {
  data: StockOverview;
  people: { id: string; name: string }[];
  onDone: (o: StockOverview) => void;
}) => {
  const active = data.items.filter((i) => i.active);
  const [f, setF] = useState({
    kind: 'in' as StockMoveInput['kind'],
    itemId: active[0]?.id ?? '',
    zoneId: data.zones[0]?.id ?? '',
    toZoneId: '',
    employeeId: '',
    qty: '',
    note: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const have = data.levels.find((l) => l.itemId === f.itemId && l.zoneId === f.zoneId)?.qty ?? 0;
  const unit = data.items.find((i) => i.id === f.itemId)?.unit ?? '';
  const move = useMutation({
    mutationFn: () =>
      opsApi.moveStock({
        kind: f.kind,
        itemId: f.itemId,
        zoneId: f.zoneId,
        qty: Number(f.qty),
        ...(f.kind === 'transfer' ? { toZoneId: f.toZoneId } : {}),
        ...(f.kind === 'issue' ? { employeeId: f.employeeId } : {}),
        note: f.note.trim() || undefined,
      }),
    onSuccess: (o) => {
      setF((p) => ({ ...p, qty: '', note: '' }));
      onDone(o);
    },
  });
  const qty = Number(f.qty);
  const valid =
    !!f.itemId &&
    !!f.zoneId &&
    Number.isInteger(qty) &&
    (f.kind === 'adjust' ? qty !== 0 && !!f.note.trim() : qty > 0) &&
    (f.kind !== 'transfer' || (!!f.toZoneId && f.toZoneId !== f.zoneId)) &&
    (f.kind !== 'issue' || !!f.employeeId);

  return (
    <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-4'>
      <h2 className='text-sm font-semibold text-slate-700'>Record a move</h2>
      <div className='grid gap-2 sm:grid-cols-3'>
        <select value={f.kind} onChange={(e) => set('kind')(e.target.value)} className={inputClass}>
          {Object.entries(MOVE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={f.itemId}
          onChange={(e) => set('itemId')(e.target.value)}
          className={inputClass}
        >
          {active.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} · {i.name}
            </option>
          ))}
        </select>
        <select
          value={f.zoneId}
          onChange={(e) => set('zoneId')(e.target.value)}
          className={inputClass}
        >
          {data.zones.map((z) => (
            <option key={z.id} value={z.id}>
              {f.kind === 'transfer' ? 'From ' : 'At '}
              {z.name}
            </option>
          ))}
        </select>
        {f.kind === 'transfer' && (
          <select
            value={f.toZoneId}
            onChange={(e) => set('toZoneId')(e.target.value)}
            className={inputClass}
          >
            <option value=''>To zone…</option>
            {data.zones
              .filter((z) => z.id !== f.zoneId)
              .map((z) => (
                <option key={z.id} value={z.id}>
                  To {z.name}
                </option>
              ))}
          </select>
        )}
        {f.kind === 'issue' && (
          <select
            value={f.employeeId}
            onChange={(e) => set('employeeId')(e.target.value)}
            className={inputClass}
          >
            <option value=''>Who takes it…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input
          type='number'
          value={f.qty}
          onChange={(e) => set('qty')(e.target.value)}
          placeholder={f.kind === 'adjust' ? 'Change, e.g. -3 or 5' : `Quantity (${unit})`}
          className={inputClass}
        />
        <input
          value={f.note}
          onChange={(e) => set('note')(e.target.value)}
          placeholder={f.kind === 'adjust' ? 'Why the count changed (required)' : 'Note (optional)'}
          className={`${inputClass} sm:col-span-2`}
        />
      </div>
      <p className='text-xs text-slate-500'>
        {have} {unit} in this zone now.
      </p>
      {move.error && <p className='text-sm text-red-600'>{apiErrorMessage(move.error)}</p>}
      <div className='flex justify-end'>
        <button
          type='button'
          disabled={!valid || move.isPending}
          onClick={() => move.mutate()}
          className={primaryBtn}
        >
          {move.isPending ? 'Saving…' : 'Record'}
        </button>
      </div>
    </div>
  );
};

/** Add a stock item (SKU, name, unit). */
const NewItem = ({ onDone }: { onDone: (o: StockOverview) => void }) => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ sku: '', name: '', category: '', unit: 'pcs' });
  const create = useMutation({
    mutationFn: () =>
      opsApi.createStockItem({
        sku: f.sku.trim(),
        name: f.name.trim(),
        category: f.category.trim() || undefined,
        unit: f.unit.trim() || 'pcs',
      }),
    onSuccess: (o) => {
      setOpen(false);
      setF({ sku: '', name: '', category: '', unit: 'pcs' });
      onDone(o);
    },
  });
  if (!open) {
    return (
      <button type='button' onClick={() => setOpen(true)} className={secondaryBtn}>
        Add item
      </button>
    );
  }
  return (
    <div className='w-full space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
      <div className='grid gap-2 sm:grid-cols-4'>
        <input
          value={f.sku}
          onChange={(e) => setF({ ...f, sku: e.target.value })}
          placeholder='SKU'
          className={inputClass}
        />
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          placeholder='Name'
          className={inputClass}
        />
        <input
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
          placeholder='Category (optional)'
          className={inputClass}
        />
        <input
          value={f.unit}
          onChange={(e) => setF({ ...f, unit: e.target.value })}
          placeholder='Unit (pcs, m, box)'
          className={inputClass}
        />
      </div>
      {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button type='button' onClick={() => setOpen(false)} className={secondaryBtn}>
          Cancel
        </button>
        <button
          type='button'
          disabled={!f.sku.trim() || !f.name.trim() || create.isPending}
          onClick={() => create.mutate()}
          className={primaryBtn}
        >
          Add
        </button>
      </div>
    </div>
  );
};

/**
 * Consumable stock (components, cables, stationery), counted per zone. OPS
 * records stock in, issues to a person, transfers between zones and adjusts
 * after a count. No reordering or purchasing here.
 */
const StockPage = () => {
  const queryClient = useQueryClient();
  const [itemFilter, setItemFilter] = useState('');
  const overview = useQuery({ queryKey: ['ops-stock'], queryFn: opsApi.stock });
  const options = useQuery({ queryKey: ['ops-options'], queryFn: opsApi.options });
  const ledger = useQuery({
    queryKey: ['ops-stock-ledger', itemFilter],
    queryFn: () => opsApi.stockMovements(itemFilter ? { itemId: itemFilter } : {}),
  });
  const archive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      opsApi.updateStockItem(id, { active }),
    onSuccess: (o) => queryClient.setQueryData(['ops-stock'], o),
  });
  const onMoved = (o: StockOverview) => {
    queryClient.setQueryData(['ops-stock'], o);
    queryClient.invalidateQueries({ queryKey: ['ops-stock-ledger'] });
  };
  const data = overview.data;
  const qty = (itemId: string, zoneId: string) =>
    data?.levels.find((l) => l.itemId === itemId && l.zoneId === zoneId)?.qty ?? 0;

  return (
    <div className='w-full max-w-6xl space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Stock</h1>
          <p className='text-sm text-slate-500'>
            Consumables counted per zone. A zone can never go below zero; every move is kept.
          </p>
        </div>
        <NewItem onDone={(o) => queryClient.setQueryData(['ops-stock'], o)} />
      </div>
      {overview.error && <p className='text-sm text-red-600'>{apiErrorMessage(overview.error)}</p>}

      {data && (
        <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white p-4'>
          {data.items.length === 0 ? (
            <p className='text-sm text-slate-400'>No stock items yet — add one.</p>
          ) : (
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-xs text-slate-500'>
                  <th className='py-2 pr-3 font-medium'>Item</th>
                  {data.zones.map((z) => (
                    <th key={z.id} className='py-2 pr-3 text-right font-medium'>
                      {z.name}
                    </th>
                  ))}
                  <th className='py-2 pr-3 text-right font-medium'>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr
                    key={i.id}
                    className={`border-b border-slate-100 ${i.active ? '' : 'opacity-50'}`}
                  >
                    <td className='py-2 pr-3'>
                      <span className='font-mono text-xs text-slate-400'>{i.sku}</span>{' '}
                      <span className='text-slate-800'>{i.name}</span>
                      {i.category && (
                        <span className='text-xs text-slate-400'> · {i.category}</span>
                      )}
                    </td>
                    {data.zones.map((z) => (
                      <td key={z.id} className='py-2 pr-3 text-right tabular-nums'>
                        {qty(i.id, z.id) || '—'}
                      </td>
                    ))}
                    <td className='py-2 pr-3 text-right font-medium tabular-nums'>
                      {i.total} <span className='text-xs font-normal text-slate-400'>{i.unit}</span>
                    </td>
                    <td className='py-2 text-right'>
                      <button
                        type='button'
                        onClick={() => archive.mutate({ id: i.id, active: !i.active })}
                        className='text-xs text-slate-400 hover:text-slate-700'
                      >
                        {i.active ? 'Archive' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {data && data.items.some((i) => i.active) && (
        <MoveForm data={data} people={options.data?.people ?? []} onDone={onMoved} />
      )}

      <div className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h2 className='text-sm font-semibold text-slate-700'>Ledger</h2>
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className='rounded-md border border-slate-300 px-2 py-1 text-sm'
          >
            <option value=''>All items</option>
            {data?.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sku} · {i.name}
              </option>
            ))}
          </select>
        </div>
        {ledger.data?.length === 0 && <p className='text-sm text-slate-400'>No moves yet.</p>}
        <ul className='divide-y divide-slate-100 text-sm'>
          {ledger.data?.map((m) => (
            <li key={m.id} className='flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2'>
              <span className='w-28 text-xs text-slate-400'>{fmtWhen(m.createdAt)}</span>
              <span className='w-28 text-slate-600'>{STOCK_KIND_LABELS[m.kind]}</span>
              <span
                className={`w-16 text-right tabular-nums ${m.qty < 0 ? 'text-red-700' : 'text-green-700'}`}
              >
                {m.qty > 0 ? `+${m.qty}` : m.qty}
              </span>
              <span className='text-slate-800'>{m.item.name}</span>
              <span className='text-xs text-slate-500'>
                {m.zone.name}
                {m.employee ? ` · to ${m.employee.name}` : ''} · by {m.by.name}
                {m.note ? ` · ${m.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default StockPage;

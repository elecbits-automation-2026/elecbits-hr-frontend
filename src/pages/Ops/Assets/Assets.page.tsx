import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Asset, AssetStatus } from '@app-types/api.types';
import AssetDrawer, { CloseIncident, StatusChip } from '@components/Ops/AssetDrawer.component';
import AssetForm from '@components/Ops/AssetForm.component';
import ImportAssetsModal from '@components/Ops/ImportAssetsModal.component';
import JoinerTasks from '@components/Common/Onboarding/JoinerTasks.component';
import {
  ASSET_STATUS_LABELS,
  DISPOSED,
  INCIDENT_KIND_LABELS,
  chipClass,
  fmtDay,
  fmtWhen,
  inputClass,
  primaryBtn,
  secondaryBtn,
} from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';

type Tab = 'register' | 'loans' | 'incidents';

const PassBadge = ({ a }: { a: Asset }) =>
  a.openPass ? (
    <span
      className={`${chipClass} ${
        a.openPass.overdue
          ? 'bg-red-50 text-red-700'
          : a.openPass.status === 'approved'
            ? 'bg-sky-50 text-sky-700'
            : 'bg-amber-50 text-amber-800'
      }`}
    >
      {a.openPass.status === 'approved'
        ? a.openPass.overdue
          ? 'Out · overdue'
          : 'Off premises'
        : 'Pass requested'}
    </span>
  ) : null;

/**
 * OPS asset register. Every asset sits in a punch zone and may also be held
 * by one person; lab items are lent with a due date. Click a row for its
 * history and what can be done to it now.
 */
const AssetsPage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('register');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'' | 'live' | AssetStatus>('live');
  const [zone, setZone] = useState('');

  const options = useQuery({ queryKey: ['ops-options'], queryFn: opsApi.options });
  const assets = useQuery({ queryKey: ['ops-assets'], queryFn: () => opsApi.listAssets() });
  const incidents = useQuery({
    queryKey: ['ops-incidents'],
    queryFn: opsApi.incidents,
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (assets.data ?? []).filter(
      (a) =>
        (!needle ||
          [a.assetCode, a.name, a.serialNo, a.holder?.name, a.make, a.model]
            .filter(Boolean)
            .some((s) => s!.toLowerCase().includes(needle))) &&
        (!category || a.category.id === category) &&
        (!zone || a.zone.id === zone) &&
        (status === ''
          ? true
          : status === 'live'
            ? !DISPOSED.includes(a.status)
            : a.status === status),
    );
  }, [assets.data, q, category, zone, status]);

  const loans = (assets.data ?? [])
    .filter((a) => a.status === 'assigned' && a.loanDueOn)
    .sort((x, y) => (x.loanDueOn! < y.loanDueOn! ? -1 : 1));
  const counts = (assets.data ?? []).reduce<Record<string, number>>((m, a) => {
    m[a.status] = (m[a.status] ?? 0) + 1;
    return m;
  }, {});
  const openIncidents = (incidents.data ?? []).filter((i) => i.status === 'open').length;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'register', label: 'Register' },
    { key: 'loans', label: 'Lab loans', badge: loans.filter((l) => l.loanOverdue).length },
    { key: 'incidents', label: 'Incidents', badge: openIncidents },
  ];

  return (
    <div className='w-full max-w-6xl space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-800'>Assets</h1>
          <p className='text-sm text-slate-500'>
            Every asset sits in a zone; a person may also hold it. Nothing is deleted — scrapped,
            gifted and lost items keep their history.
          </p>
        </div>
        <div className='flex gap-2'>
          <button type='button' onClick={() => setImporting(true)} className={secondaryBtn}>
            Import CSV
          </button>
          <button
            type='button'
            disabled={!options.data}
            onClick={() => setAdding(true)}
            className={primaryBtn}
          >
            Add asset
          </button>
        </div>
      </div>

      <JoinerTasks owner='ops' />

      <div className='flex flex-wrap gap-2 text-xs'>
        {(['assigned', 'idle', 'in_use_shared', 'needs_repair'] as const).map((s) => (
          <span
            key={s}
            className='rounded-md bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200'
          >
            {ASSET_STATUS_LABELS[s]}: <b>{counts[s] ?? 0}</b>
          </span>
        ))}
      </div>

      <div className='flex flex-wrap gap-1 border-b border-slate-200'>
        {tabs.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.key
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className='ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800'>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {assets.error && <p className='text-sm text-red-600'>{apiErrorMessage(assets.error)}</p>}

      {tab === 'register' && (
        <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-4'>
          <div className='grid gap-2 sm:grid-cols-4'>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Search tag, name, serial, holder'
              className={inputClass}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              <option value=''>All categories</option>
              {options.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={inputClass}
            >
              <option value='live'>On the register</option>
              <option value=''>Everything (incl. left)</option>
              {Object.entries(ASSET_STATUS_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <select value={zone} onChange={(e) => setZone(e.target.value)} className={inputClass}>
              <option value=''>All zones</option>
              {options.data?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          {assets.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
          {assets.data && rows.length === 0 && (
            <p className='text-sm text-slate-400'>
              {assets.data.length === 0
                ? 'No assets yet — add one or import your list.'
                : 'Nothing matches these filters.'}
            </p>
          )}
          {rows.length > 0 && (
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-sm'>
                <thead>
                  <tr className='border-b border-slate-200 text-xs text-slate-500'>
                    <th className='py-2 pr-3 font-medium'>Tag</th>
                    <th className='py-2 pr-3 font-medium'>Name</th>
                    <th className='py-2 pr-3 font-medium'>Category</th>
                    <th className='py-2 pr-3 font-medium'>Status</th>
                    <th className='py-2 pr-3 font-medium'>Holder</th>
                    <th className='py-2 font-medium'>Zone</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setOpenId(a.id)}
                      className='cursor-pointer border-b border-slate-100 hover:bg-slate-50'
                    >
                      <td className='py-2 pr-3 font-mono text-xs text-slate-500'>{a.assetCode}</td>
                      <td className='py-2 pr-3 text-slate-800'>{a.name}</td>
                      <td className='py-2 pr-3 text-slate-600'>{a.category.name}</td>
                      <td className='py-2 pr-3'>
                        <span className='flex flex-wrap gap-1'>
                          <StatusChip status={a.status} />
                          <PassBadge a={a} />
                          {a.loanOverdue && (
                            <span className={`${chipClass} bg-red-50 text-red-700`}>
                              Loan overdue
                            </span>
                          )}
                        </span>
                      </td>
                      <td className='py-2 pr-3 text-slate-600'>{a.holder?.name ?? '—'}</td>
                      <td className='py-2 text-slate-600'>{a.zone.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'loans' && (
        <div className='rounded-xl border border-slate-200 bg-white p-4'>
          {loans.length === 0 ? (
            <p className='text-sm text-slate-400'>No lab items are out on loan.</p>
          ) : (
            <ul className='divide-y divide-slate-100'>
              {loans.map((a) => (
                <li key={a.id}>
                  <button
                    type='button'
                    onClick={() => setOpenId(a.id)}
                    className='flex w-full flex-wrap items-center gap-2 py-2.5 text-left hover:bg-slate-50'
                  >
                    <span className='font-mono text-xs text-slate-400'>{a.assetCode}</span>
                    <span className='flex-1 text-sm text-slate-800'>
                      {a.name} — {a.holder?.name}
                    </span>
                    <span
                      className={`${chipClass} ${a.loanOverdue ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {a.loanOverdue ? 'Overdue since' : 'Due'} {fmtDay(a.loanDueOn)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'incidents' && (
        <div className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
          {incidents.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
          {incidents.error && (
            <p className='text-sm text-red-600'>{apiErrorMessage(incidents.error)}</p>
          )}
          {incidents.data?.length === 0 && (
            <p className='text-sm text-slate-400'>No damage, loss or theft recorded.</p>
          )}
          {incidents.data?.map((i) => (
            <div key={i.id} className='rounded-lg border border-slate-200 p-3 text-sm'>
              <div className='flex flex-wrap items-center gap-2'>
                <span
                  className={`${chipClass} ${i.status === 'open' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}
                >
                  {i.status === 'open' ? 'Open' : 'Closed'}
                </span>
                <span className='font-medium text-slate-700'>{INCIDENT_KIND_LABELS[i.kind]}</span>
                <button
                  type='button'
                  onClick={() => setOpenId(i.asset.id)}
                  className='text-brand-700 hover:underline'
                >
                  {i.asset.assetCode} {i.asset.name}
                </button>
                <span className='text-xs text-slate-400'>
                  {fmtWhen(i.createdAt)} · reported by {i.reportedBy.name}
                  {i.employee ? ` · with ${i.employee.name}` : ''}
                </span>
              </div>
              <p className='mt-1 text-slate-600'>{i.description}</p>
              {i.status === 'closed' ? (
                <p className='mt-1 text-xs text-slate-500'>
                  Closed by {i.closedBy?.name}: {i.outcome}
                </p>
              ) : (
                <CloseIncident
                  incident={i}
                  onDone={() => {
                    queryClient.invalidateQueries({ queryKey: ['ops-incidents'] });
                    queryClient.invalidateQueries({ queryKey: ['ops-assets'] });
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {adding && options.data && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
          <div className='max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
            <h2 className='mb-4 text-lg font-semibold text-slate-800'>Add an asset</h2>
            <AssetForm
              options={options.data}
              onCancel={() => setAdding(false)}
              onSaved={(a) => {
                setAdding(false);
                queryClient.invalidateQueries({ queryKey: ['ops-assets'] });
                setOpenId(a.id);
              }}
            />
          </div>
        </div>
      )}
      {importing && <ImportAssetsModal onClose={() => setImporting(false)} />}
      {openId && options.data && (
        <AssetDrawer assetId={openId} options={options.data} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
};

export default AssetsPage;

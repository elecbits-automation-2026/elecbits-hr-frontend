import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AssetIncidentKind, AssetRequestType, MyAssetsOverview } from '@app-types/api.types';
import {
  ASSET_STATUS_CLASS,
  ASSET_STATUS_LABELS,
  INCIDENT_KIND_LABELS,
  PASS_STATUS_CLASS,
  PASS_STATUS_LABELS,
  REQUEST_STATUS_CLASS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  chipClass,
  fmtDay,
  fmtWhen,
  inputClass,
  opsToday,
  primaryBtn,
  secondaryBtn,
} from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';

const card = 'space-y-3 rounded-xl border border-slate-200 bg-white p-5';

/**
 * "Is it back?" for one lent item or gate pass: back (it returns to its zone
 * and OPS is told) or still out (why, and a new date — OPS is told).
 */
const ReturnPrompt = ({
  label,
  due,
  overdue,
  zone,
  onBack,
  onExtend,
  onDone,
}: {
  label: string;
  due: string;
  overdue: boolean;
  zone: string;
  onBack: () => Promise<unknown>;
  onExtend: (input: { returnOn: string; reason: string }) => Promise<unknown>;
  onDone: () => void;
}) => {
  const [extending, setExtending] = useState(false);
  const [returnOn, setReturnOn] = useState('');
  const [reason, setReason] = useState('');
  const act = useMutation({
    mutationFn: (what: 'back' | 'extend') =>
      what === 'back' ? onBack() : onExtend({ returnOn, reason: reason.trim() }),
    onSuccess: () => {
      setExtending(false);
      onDone();
    },
  });
  return (
    <li
      className={`space-y-2 rounded-lg border p-3 ${overdue ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}`}
    >
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-sm font-medium text-slate-800'>{label}</span>
        <span
          className={`${chipClass} ${overdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}
        >
          {overdue ? `Was due ${fmtDay(due)}` : `Due back ${fmtDay(due)}`}
        </span>
      </div>
      {overdue && !extending && <p className='text-sm text-slate-700'>Is it back at {zone}?</p>}
      {!extending ? (
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            disabled={act.isPending}
            onClick={() => act.mutate('back')}
            className={primaryBtn}
          >
            It's back at {zone}
          </button>
          <button type='button' onClick={() => setExtending(true)} className={secondaryBtn}>
            Still out
          </button>
        </div>
      ) : (
        <div className='space-y-2'>
          <input
            type='date'
            min={opsToday() > due ? opsToday() : due}
            value={returnOn}
            onChange={(e) => setReturnOn(e.target.value)}
            className={`${inputClass} max-w-xs`}
          />
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Why is it still out?'
            className={inputClass}
          />
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => setExtending(false)} className={secondaryBtn}>
              Back
            </button>
            <button
              type='button'
              disabled={!returnOn || reason.trim().length < 3 || act.isPending}
              onClick={() => act.mutate('extend')}
              className={primaryBtn}
            >
              Save new date
            </button>
          </div>
        </div>
      )}
      {act.error && <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>}
    </li>
  );
};

/** Report damage / loss / theft of something I'm answerable for. */
const ReportProblem = ({ assetId, onDone }: { assetId: string; onDone: () => void }) => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AssetIncidentKind>('damage');
  const [description, setDescription] = useState('');
  const report = useMutation({
    mutationFn: () => opsApi.reportMyIncident(assetId, { kind, description }),
    onSuccess: () => {
      setOpen(false);
      setDescription('');
      onDone();
    },
  });
  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='text-xs text-slate-500 hover:text-slate-800'
      >
        Report damage or loss
      </button>
    );
  }
  return (
    <div className='mt-2 space-y-2 rounded-lg bg-slate-50 p-3'>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as AssetIncidentKind)}
        className={inputClass}
      >
        {Object.entries(INCIDENT_KIND_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder='What happened, when and where'
        className={inputClass}
      />
      {report.error && <p className='text-sm text-red-600'>{apiErrorMessage(report.error)}</p>}
      {report.isSuccess && <p className='text-sm text-green-700'>Reported — OPS has been told.</p>}
      <div className='flex justify-end gap-2'>
        <button type='button' onClick={() => setOpen(false)} className={secondaryBtn}>
          Cancel
        </button>
        <button
          type='button'
          disabled={description.trim().length < 5 || report.isPending}
          onClick={() => report.mutate()}
          className={primaryBtn}
        >
          Report
        </button>
      </div>
    </div>
  );
};

const RequestForm = ({ data, onDone }: { data: MyAssetsOverview; onDone: () => void }) => {
  const [type, setType] = useState<AssetRequestType>('new');
  const [assetId, setAssetId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const create = useMutation({
    mutationFn: () =>
      opsApi.createRequest({
        type,
        ...(type !== 'new' ? { assetId } : {}),
        ...(categoryId && type !== 'repair' && type !== 'return' ? { categoryId } : {}),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setAssetId('');
      setCategoryId('');
      setNote('');
      onDone();
    },
  });
  const valid = type === 'new' ? !!categoryId || !!note.trim() : !!assetId;
  return (
    <div className='space-y-2'>
      <div className='grid gap-2 sm:grid-cols-3'>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AssetRequestType)}
          className={inputClass}
        >
          {Object.entries(REQUEST_TYPE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        {type !== 'new' && (
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className={inputClass}
          >
            <option value=''>Which of your items?</option>
            {data.held.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetCode} · {a.name}
              </option>
            ))}
          </select>
        )}
        {(type === 'new' || type === 'upgrade' || type === 'replacement') && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value=''>What kind? (optional)</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={type === 'new' ? 'What do you need and why' : 'Anything OPS should know'}
        className={inputClass}
      />
      {type !== 'new' && data.held.length === 0 && (
        <p className='text-xs text-slate-500'>You don't hold anything to ask about.</p>
      )}
      {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}
      <div className='flex justify-end'>
        <button
          type='button'
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
          className={primaryBtn}
        >
          Send to OPS
        </button>
      </div>
    </div>
  );
};

const PassForm = ({ data, onDone }: { data: MyAssetsOverview; onDone: () => void }) => {
  const [f, setF] = useState({
    assetId: '',
    purpose: '',
    destination: '',
    returnOn: '',
    ok: false,
  });
  const create = useMutation({
    mutationFn: () =>
      opsApi.requestGatePass({
        assetId: f.assetId,
        purpose: f.purpose.trim(),
        destination: f.destination.trim(),
        returnOn: f.returnOn,
        disclaimerAccepted: true,
      }),
    onSuccess: () => {
      setF({ assetId: '', purpose: '', destination: '', returnOn: '', ok: false });
      onDone();
    },
  });
  if (data.passable.length === 0) {
    return (
      <p className='text-sm text-slate-500'>
        Nothing you can take out right now. Gate passes are for lab equipment, products and samples
        — not laptops.
      </p>
    );
  }
  const valid =
    !!f.assetId &&
    f.purpose.trim().length >= 3 &&
    f.destination.trim().length >= 2 &&
    !!f.returnOn &&
    f.ok;
  return (
    <div className='space-y-2'>
      <div className='grid gap-2 sm:grid-cols-2'>
        <select
          value={f.assetId}
          onChange={(e) => setF({ ...f, assetId: e.target.value })}
          className={inputClass}
        >
          <option value=''>Which item?</option>
          {data.passable.map((a) => (
            <option key={a.id} value={a.id}>
              {a.assetCode} · {a.name} · {a.zone}
              {a.mine ? ' (yours)' : ''}
            </option>
          ))}
        </select>
        <label className='flex items-center gap-2 text-sm text-slate-600'>
          Back by
          <input
            type='date'
            min={opsToday()}
            value={f.returnOn}
            onChange={(e) => setF({ ...f, returnOn: e.target.value })}
            className={inputClass}
          />
        </label>
        <input
          value={f.destination}
          onChange={(e) => setF({ ...f, destination: e.target.value })}
          placeholder='Where is it going'
          className={inputClass}
        />
        <input
          value={f.purpose}
          onChange={(e) => setF({ ...f, purpose: e.target.value })}
          placeholder='Why'
          className={inputClass}
        />
      </div>
      <label className='flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>
        <input
          type='checkbox'
          checked={f.ok}
          onChange={(e) => setF({ ...f, ok: e.target.checked })}
          className='mt-0.5'
        />
        <span>{data.disclaimer}</span>
      </label>
      {create.error && <p className='text-sm text-red-600'>{apiErrorMessage(create.error)}</p>}
      <div className='flex justify-end'>
        <button
          type='button'
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
          className={primaryBtn}
        >
          Request gate pass
        </button>
      </div>
    </div>
  );
};

/**
 * My assets: what I hold (lent items with their due dates), gate passes I'm
 * answerable for, my requests to OPS and stock issued to me.
 */
const MyAssetsPage = () => {
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-assets'], queryFn: opsApi.mine });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-assets'] });
  const data = mine.data;
  const loans = (data?.held ?? []).filter((a) => a.loanDueOn);
  const outPasses = (data?.passes ?? []).filter((p) => p.status === 'approved');

  return (
    <div className='w-full max-w-4xl space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>My assets</h1>
        <p className='text-sm text-slate-500'>
          Company property in your care, for business use only (Code of Conduct). Everything you
          hold is returned when you leave.
        </p>
      </div>
      {mine.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
      {mine.error && <p className='text-sm text-red-600'>{apiErrorMessage(mine.error)}</p>}

      {data && (loans.length > 0 || outPasses.length > 0) && (
        <section className={card}>
          <h2 className='text-sm font-semibold text-slate-700'>Due back</h2>
          <ul className='space-y-2'>
            {loans.map((a) => (
              <ReturnPrompt
                key={a.id}
                label={`${a.name} (${a.assetCode}) — lent to you`}
                due={a.loanDueOn!}
                overdue={a.loanOverdue}
                zone={a.zone.name}
                onBack={() => opsApi.loanBack(a.id)}
                onExtend={(input) => opsApi.loanExtend(a.id, input)}
                onDone={refresh}
              />
            ))}
            {outPasses.map((p) => (
              <ReturnPrompt
                key={p.id}
                label={`${p.asset.name} (${p.asset.assetCode}) — out to ${p.destination}`}
                due={p.returnOn}
                overdue={p.overdue}
                zone={p.asset.zone.name}
                onBack={() => opsApi.passBack(p.id)}
                onExtend={(input) => opsApi.passExtend(p.id, input)}
                onDone={refresh}
              />
            ))}
          </ul>
        </section>
      )}

      {data && (
        <section className={card}>
          <h2 className='text-sm font-semibold text-slate-700'>What you hold</h2>
          {data.held.length === 0 ? (
            <p className='text-sm text-slate-400'>Nothing is assigned to you.</p>
          ) : (
            <ul className='divide-y divide-slate-100'>
              {data.held.map((a) => (
                <li key={a.id} className='py-2.5'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-mono text-xs text-slate-400'>{a.assetCode}</span>
                    <span className='text-sm font-medium text-slate-800'>{a.name}</span>
                    <span className='text-xs text-slate-500'>
                      {a.category.name} · {a.zone.name}
                      {a.serialNo ? ` · S/N ${a.serialNo}` : ''}
                    </span>
                    <span className={`${chipClass} ${ASSET_STATUS_CLASS[a.status]} ml-auto`}>
                      {a.loanDueOn
                        ? `Lent until ${fmtDay(a.loanDueOn)}`
                        : ASSET_STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  <ReportProblem assetId={a.id} onDone={refresh} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && (
        <section className={card}>
          <h2 className='text-sm font-semibold text-slate-700'>Ask OPS</h2>
          <p className='text-xs text-slate-500'>
            A new asset, an upgrade or replacement (OPS takes the old one back when they hand over
            the new one), a repair, or returning something.
          </p>
          <RequestForm data={data} onDone={refresh} />
          {data.requests.length > 0 && (
            <ul className='divide-y divide-slate-100 border-t border-slate-100 pt-2'>
              {data.requests.map((r) => (
                <li key={r.id} className='space-y-0.5 py-2 text-sm'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className={`${chipClass} ${REQUEST_STATUS_CLASS[r.status]}`}>
                      {REQUEST_STATUS_LABELS[r.status]}
                    </span>
                    <span className='text-slate-800'>{REQUEST_TYPE_LABELS[r.type]}</span>
                    {r.asset && <span className='text-xs text-slate-500'>{r.asset.assetCode}</span>}
                    {r.category && (
                      <span className='text-xs text-slate-500'>{r.category.name}</span>
                    )}
                    <span className='ml-auto text-xs text-slate-400'>{fmtWhen(r.createdAt)}</span>
                  </div>
                  {r.handlerNote && <p className='text-xs text-slate-500'>OPS: {r.handlerNote}</p>}
                  {r.fulfilledAsset && (
                    <p className='text-xs text-green-700'>
                      You got {r.fulfilledAsset.assetCode} {r.fulfilledAsset.name}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && (
        <section className={card}>
          <h2 className='text-sm font-semibold text-slate-700'>Take something out (gate pass)</h2>
          <PassForm data={data} onDone={refresh} />
          {data.passes.length > 0 && (
            <ul className='divide-y divide-slate-100 border-t border-slate-100 pt-2'>
              {data.passes.map((p) => (
                <li key={p.id} className='flex flex-wrap items-center gap-2 py-2 text-sm'>
                  <span
                    className={`${chipClass} ${p.overdue ? 'bg-red-50 text-red-700' : PASS_STATUS_CLASS[p.status]}`}
                  >
                    {p.overdue ? 'Overdue' : PASS_STATUS_LABELS[p.status]}
                  </span>
                  <span className='text-slate-800'>
                    {p.asset.name} → {p.destination}
                  </span>
                  <span className='text-xs text-slate-400'>back by {fmtDay(p.returnOn)}</span>
                  {p.declineReason && (
                    <span className='text-xs text-slate-500'>· {p.declineReason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && data.stock.length > 0 && (
        <section className={card}>
          <h2 className='text-sm font-semibold text-slate-700'>Stock issued to you</h2>
          <ul className='divide-y divide-slate-100 text-sm'>
            {data.stock.map((m) => (
              <li key={m.id} className='flex flex-wrap gap-2 py-2'>
                <span className='text-slate-800'>
                  {Math.abs(m.qty)} {m.item.unit} · {m.item.name}
                </span>
                <span className='text-xs text-slate-400'>
                  {m.zone.name} · {fmtWhen(m.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default MyAssetsPage;

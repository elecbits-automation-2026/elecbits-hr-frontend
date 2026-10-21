import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AssetCondition,
  AssetDetail,
  AssetIncident,
  AssetIncidentKind,
  AssetOptions,
} from '@app-types/api.types';
import {
  ASSET_STATUS_CLASS,
  ASSET_STATUS_LABELS,
  CONDITION_LABELS,
  DISPOSED,
  EVENT_LABELS,
  INCIDENT_KIND_LABELS,
  PASS_STATUS_CLASS,
  PASS_STATUS_LABELS,
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

import AssetForm from './AssetForm.component';

type Mode = null | 'issue' | 'return' | 'transfer' | 'move' | 'status' | 'incident' | 'edit';

export const StatusChip = ({ status }: { status: AssetDetail['status'] }) => (
  <span className={`${chipClass} ${ASSET_STATUS_CLASS[status]}`}>
    {ASSET_STATUS_LABELS[status]}
  </span>
);

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className='flex gap-2 text-sm'>
    <span className='w-32 shrink-0 text-slate-400'>{label}</span>
    <span className='text-slate-700'>{value}</span>
  </div>
);

/** Close an incident; a loss or theft can confirm the asset is gone. */
export const CloseIncident = ({
  incident,
  onDone,
}: {
  incident: AssetIncident;
  onDone: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [lost, setLost] = useState(false);
  const close = useMutation({
    mutationFn: () => opsApi.closeIncident(incident.id, { outcome, assetLost: lost }),
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });
  if (!open) {
    return (
      <button type='button' onClick={() => setOpen(true)} className={secondaryBtn}>
        Close incident
      </button>
    );
  }
  return (
    <div className='mt-2 space-y-2'>
      <textarea
        rows={2}
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        placeholder='What was found / decided'
        className={inputClass}
      />
      {incident.kind !== 'damage' && (
        <label className='flex items-center gap-2 text-sm text-slate-600'>
          <input type='checkbox' checked={lost} onChange={(e) => setLost(e.target.checked)} />
          The asset is gone — mark it lost (final)
        </label>
      )}
      {close.error && <p className='text-sm text-red-600'>{apiErrorMessage(close.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button type='button' onClick={() => setOpen(false)} className={secondaryBtn}>
          Back
        </button>
        <button
          type='button'
          disabled={outcome.trim().length < 2 || close.isPending}
          onClick={() => close.mutate()}
          className={primaryBtn}
        >
          Close
        </button>
      </div>
    </div>
  );
};

/** The person + zone + due-date fields shared by issue and transfer. */
const HandOverFields = ({
  options,
  a,
  v,
  set,
}: {
  options: AssetOptions;
  a: AssetDetail;
  v: { employeeId: string; zoneId: string; dueOn: string };
  set: (k: 'employeeId' | 'zoneId' | 'dueOn', val: string) => void;
}) => (
  <>
    <select
      value={v.employeeId}
      onChange={(e) => set('employeeId', e.target.value)}
      className={inputClass}
    >
      <option value=''>Choose a person…</option>
      {options.people
        .filter((p) => p.id !== a.holder?.id)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.designation ? ` · ${p.designation}` : ''}
          </option>
        ))}
    </select>
    <select value={v.zoneId} onChange={(e) => set('zoneId', e.target.value)} className={inputClass}>
      <option value=''>Zone: their base zone (or where it is now)</option>
      {options.zones.map((z) => (
        <option key={z.id} value={z.id}>
          Zone: {z.name}
        </option>
      ))}
    </select>
    {a.category.kind === 'lab' && (
      <label className='block space-y-1'>
        <span className='text-xs text-slate-500'>Lent until</span>
        <input
          type='date'
          min={opsToday()}
          value={v.dueOn}
          onChange={(e) => set('dueOn', e.target.value)}
          className={inputClass}
        />
      </label>
    )}
  </>
);

/**
 * One asset: details, what can be done to it now, incidents, gate passes and
 * its full history. OPS only.
 */
const AssetDrawer = ({
  assetId,
  options,
  onClose,
}: {
  assetId: string;
  options: AssetOptions;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [v, setV] = useState({
    employeeId: '',
    zoneId: '',
    dueOn: '',
    condition: 'good' as AssetCondition,
    toStatus: '',
    status: 'idle',
    giftedTo: '',
    note: '',
    kind: 'damage' as AssetIncidentKind,
  });
  const set = (k: keyof typeof v, val: string) => setV((p) => ({ ...p, [k]: val }));

  const detail = useQuery({
    queryKey: ['ops-asset', assetId],
    queryFn: () => opsApi.getAsset(assetId),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ops-asset', assetId] });
    queryClient.invalidateQueries({ queryKey: ['ops-assets'] });
    queryClient.invalidateQueries({ queryKey: ['ops-incidents'] });
  };

  const note = v.note.trim() || undefined;
  const act = useMutation({
    mutationFn: async () => {
      switch (mode) {
        case 'issue':
          return opsApi.issue(assetId, {
            employeeId: v.employeeId,
            zoneId: v.zoneId || undefined,
            dueOn: v.dueOn || undefined,
            note,
          });
        case 'return':
          return opsApi.takeBack(assetId, {
            condition: v.condition,
            toStatus: (v.toStatus || undefined) as 'idle' | undefined,
            note,
          });
        case 'transfer':
          return opsApi.transfer(assetId, {
            employeeId: v.employeeId,
            zoneId: v.zoneId || undefined,
            dueOn: v.dueOn || undefined,
            note,
          });
        case 'move':
          return opsApi.move(assetId, { zoneId: v.zoneId, note });
        case 'status':
          return opsApi.setStatus(assetId, {
            status: v.status as 'idle',
            giftedTo: v.giftedTo || undefined,
            note,
          });
        case 'incident':
          return opsApi.reportIncident(assetId, { kind: v.kind, description: v.note });
        default:
          return undefined;
      }
    },
    onSuccess: () => {
      setMode(null);
      setV((p) => ({ ...p, employeeId: '', zoneId: '', dueOn: '', note: '', giftedTo: '' }));
      refresh();
    },
  });

  const a = detail.data;
  const disposed = a ? DISPOSED.includes(a.status) : false;
  const onPass = !!a?.openPass;

  const actions: { mode: Exclude<Mode, null>; label: string; show: boolean }[] = a
    ? [
        {
          mode: 'issue',
          label: a.category.kind === 'lab' ? 'Lend' : 'Issue',
          show: !disposed && !onPass && (a.status === 'idle' || a.status === 'in_use_shared'),
        },
        { mode: 'return', label: 'Take back', show: a.status === 'assigned' && !onPass },
        { mode: 'transfer', label: 'Hand over', show: a.status === 'assigned' && !onPass },
        { mode: 'move', label: 'Move zone', show: !disposed },
        { mode: 'status', label: 'Change status', show: !disposed && !onPass },
        { mode: 'incident', label: 'Report incident', show: !disposed },
        { mode: 'edit', label: 'Edit details', show: true },
      ]
    : [];

  const canSubmit =
    (mode === 'issue' || mode === 'transfer'
      ? !!v.employeeId && (a?.category.kind !== 'lab' || !!v.dueOn)
      : true) &&
    (mode === 'move' ? !!v.zoneId : true) &&
    (mode === 'incident' ? v.note.trim().length >= 5 : true) &&
    (mode === 'status' && (v.status === 'scrapped' || v.status === 'gifted')
      ? !!v.note.trim()
      : true);

  return (
    <div className='fixed inset-0 z-50 flex justify-end bg-slate-900/30'>
      <button
        type='button'
        aria-label='Close'
        className='flex-1 cursor-default'
        onClick={onClose}
      />
      <div className='h-full w-full max-w-xl space-y-5 overflow-y-auto bg-white p-6 shadow-xl'>
        <div className='flex justify-end'>
          <button
            type='button'
            onClick={onClose}
            className='text-sm text-slate-500 hover:text-slate-800'
          >
            Close ✕
          </button>
        </div>
        {detail.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
        {detail.error && <p className='text-sm text-red-600'>{apiErrorMessage(detail.error)}</p>}
        {a && (
          <>
            <div className='space-y-1'>
              <p className='font-mono text-xs text-slate-400'>{a.assetCode}</p>
              <h2 className='text-lg font-semibold text-slate-800'>{a.name}</h2>
              <div className='flex flex-wrap items-center gap-2'>
                <StatusChip status={a.status} />
                {a.openPass && (
                  <span
                    className={`${chipClass} ${a.openPass.overdue ? 'bg-red-50 text-red-700' : PASS_STATUS_CLASS[a.openPass.status]}`}
                  >
                    {a.openPass.status === 'approved'
                      ? `Off premises with ${a.openPass.holder.name} until ${fmtDay(a.openPass.returnOn)}`
                      : `Gate pass requested by ${a.openPass.holder.name}`}
                  </span>
                )}
                {a.loanOverdue && (
                  <span className={`${chipClass} bg-red-50 text-red-700`}>Loan overdue</span>
                )}
              </div>
            </div>

            <div className='space-y-1.5 rounded-lg border border-slate-200 p-4'>
              <Row
                label='Category'
                value={`${a.category.name}${a.category.kind === 'lab' ? ' (lent)' : ''}`}
              />
              <Row label='Zone' value={a.zone.name} />
              <Row label='Held by' value={a.holder?.name ?? 'Nobody — belongs to the zone'} />
              {a.loanDueOn && <Row label='Due back' value={fmtDay(a.loanDueOn)} />}
              <Row label='Condition' value={CONDITION_LABELS[a.condition]} />
              <Row
                label='Make / model'
                value={[a.make, a.model].filter(Boolean).join(' ') || '—'}
              />
              <Row label='Serial' value={a.serialNo ?? '—'} />
              <Row
                label='Purchased'
                value={`${fmtDay(a.purchasedOn)}${a.purchaseCost !== null ? ` · ₹${a.purchaseCost.toLocaleString('en-IN')}` : ''}${a.vendor ? ` · ${a.vendor}` : ''}`}
              />
              <Row label='Warranty until' value={fmtDay(a.warrantyUntil)} />
              {a.notes && <Row label='Notes' value={a.notes} />}
              {disposed && (
                <Row
                  label='Left the register'
                  value={`${fmtDay(a.disposedOn)}${a.giftedTo ? ` · to ${a.giftedTo.name}` : ''} — ${a.disposeReason ?? ''}`}
                />
              )}
            </div>

            <div className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                {actions
                  .filter((x) => x.show)
                  .map((x) => (
                    <button
                      key={x.mode}
                      type='button'
                      onClick={() => {
                        act.reset();
                        if (x.mode === 'status') {
                          // Start on an option the select actually offers.
                          set(
                            'status',
                            a.status === 'assigned'
                              ? 'gifted'
                              : a.status === 'idle'
                                ? 'in_use_shared'
                                : 'idle',
                          );
                        }
                        setMode(mode === x.mode ? null : x.mode);
                      }}
                      className={mode === x.mode ? primaryBtn : secondaryBtn}
                    >
                      {x.label}
                    </button>
                  ))}
              </div>
              {onPass && (
                <p className='text-xs text-slate-500'>
                  Custody can't change while a gate pass is live — decide or close it on the Gate
                  passes page first.
                </p>
              )}

              {mode === 'edit' && (
                <AssetForm
                  options={options}
                  asset={a}
                  onSaved={() => {
                    setMode(null);
                    refresh();
                  }}
                  onCancel={() => setMode(null)}
                />
              )}

              {mode && mode !== 'edit' && (
                <div className='space-y-2 rounded-lg bg-slate-50 p-3'>
                  {(mode === 'issue' || mode === 'transfer') && (
                    <HandOverFields options={options} a={a} v={v} set={set} />
                  )}
                  {mode === 'return' && (
                    <>
                      <select
                        value={v.condition}
                        onChange={(e) => set('condition', e.target.value)}
                        className={inputClass}
                      >
                        {Object.entries(CONDITION_LABELS).map(([k, l]) => (
                          <option key={k} value={k}>
                            Condition on return: {l}
                          </option>
                        ))}
                      </select>
                      <select
                        value={v.toStatus}
                        onChange={(e) => set('toStatus', e.target.value)}
                        className={inputClass}
                      >
                        <option value=''>Then: idle (damaged → needs repair)</option>
                        <option value='idle'>Then: idle</option>
                        <option value='in_use_shared'>Then: in use (shared)</option>
                        <option value='needs_repair'>Then: needs repair</option>
                      </select>
                    </>
                  )}
                  {mode === 'move' && (
                    <select
                      value={v.zoneId}
                      onChange={(e) => set('zoneId', e.target.value)}
                      className={inputClass}
                    >
                      <option value=''>Move to zone…</option>
                      {options.zones
                        .filter((z) => z.id !== a.zone.id)
                        .map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                    </select>
                  )}
                  {mode === 'status' && (
                    <>
                      <select
                        value={v.status}
                        onChange={(e) => set('status', e.target.value)}
                        className={inputClass}
                      >
                        {a.status !== 'assigned' &&
                          (['idle', 'in_use_shared', 'needs_repair', 'scrapped'] as const)
                            .filter((s) => s !== a.status)
                            .map((s) => (
                              <option key={s} value={s}>
                                {ASSET_STATUS_LABELS[s]}
                              </option>
                            ))}
                        <option value='gifted'>Gifted</option>
                      </select>
                      {a.status === 'assigned' && (
                        <p className='text-xs text-slate-500'>
                          Held by {a.holder?.name} — take it back first to change anything but a
                          gift (which goes to them).
                        </p>
                      )}
                      {v.status === 'gifted' && a.status !== 'assigned' && (
                        <select
                          value={v.giftedTo}
                          onChange={(e) => set('giftedTo', e.target.value)}
                          className={inputClass}
                        >
                          <option value=''>Gifted to…</option>
                          {options.people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {(v.status === 'scrapped' || v.status === 'gifted') && (
                        <p className='text-xs text-amber-700'>
                          Final — it leaves the register (the record is kept). Say why below.
                        </p>
                      )}
                    </>
                  )}
                  {mode === 'incident' && (
                    <select
                      value={v.kind}
                      onChange={(e) => set('kind', e.target.value)}
                      className={inputClass}
                    >
                      {Object.entries(INCIDENT_KIND_LABELS).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  )}
                  <textarea
                    rows={2}
                    value={v.note}
                    onChange={(e) => set('note', e.target.value)}
                    placeholder={mode === 'incident' ? 'What happened' : 'Note (optional)'}
                    className={inputClass}
                  />
                  {act.error && (
                    <p className='text-sm text-red-600'>{apiErrorMessage(act.error)}</p>
                  )}
                  <div className='flex justify-end gap-2'>
                    <button type='button' onClick={() => setMode(null)} className={secondaryBtn}>
                      Cancel
                    </button>
                    <button
                      type='button'
                      disabled={!canSubmit || act.isPending}
                      onClick={() => act.mutate()}
                      className={primaryBtn}
                    >
                      {act.isPending ? 'Saving…' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {a.incidents.length > 0 && (
              <section className='space-y-2'>
                <h3 className='text-sm font-semibold text-slate-700'>Incidents</h3>
                {a.incidents.map((i) => (
                  <div key={i.id} className='rounded-lg border border-slate-200 p-3 text-sm'>
                    <p className='font-medium text-slate-700'>
                      {INCIDENT_KIND_LABELS[i.kind]}
                      {i.employee ? ` · with ${i.employee.name}` : ''}
                      <span className='ml-2 text-xs font-normal text-slate-400'>
                        {fmtWhen(i.createdAt)} · reported by {i.reportedBy.name}
                      </span>
                    </p>
                    <p className='text-slate-600'>{i.description}</p>
                    {i.status === 'closed' ? (
                      <p className='mt-1 text-xs text-slate-500'>
                        Closed by {i.closedBy?.name}: {i.outcome}
                      </p>
                    ) : (
                      <CloseIncident incident={i} onDone={refresh} />
                    )}
                  </div>
                ))}
              </section>
            )}

            {a.passes.length > 0 && (
              <section className='space-y-2'>
                <h3 className='text-sm font-semibold text-slate-700'>Gate passes</h3>
                <ul className='space-y-1 text-sm'>
                  {a.passes.map((p) => (
                    <li key={p.id} className='flex flex-wrap items-center gap-2'>
                      <span className={`${chipClass} ${PASS_STATUS_CLASS[p.status]}`}>
                        {PASS_STATUS_LABELS[p.status]}
                      </span>
                      <span className='text-slate-700'>
                        {p.holder.name} → {p.destination}
                      </span>
                      <span className='text-xs text-slate-400'>until {fmtDay(p.returnOn)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className='space-y-2'>
              <h3 className='text-sm font-semibold text-slate-700'>History</h3>
              <ol className='space-y-2 border-l border-slate-200 pl-4'>
                {a.events.map((e) => (
                  <li key={e.id} className='text-sm'>
                    <p className='text-slate-700'>
                      {EVENT_LABELS[e.kind] ?? e.kind}
                      {e.employee ? ` — ${e.employee.name}` : ''}
                      {e.status && e.kind === 'status_changed'
                        ? ` → ${ASSET_STATUS_LABELS[e.status]}`
                        : ''}
                      {e.zone && (e.kind === 'zone_changed' || e.kind === 'issued')
                        ? ` · ${e.zone.name}`
                        : ''}
                      {e.condition ? ` · ${CONDITION_LABELS[e.condition]}` : ''}
                      {e.dueOn ? ` · due ${fmtDay(e.dueOn)}` : ''}
                      {e.prevDueOn ? ` (was ${fmtDay(e.prevDueOn)})` : ''}
                    </p>
                    {e.note && <p className='text-xs text-slate-500'>{e.note}</p>}
                    <p className='text-xs text-slate-400'>
                      {fmtWhen(e.at)}
                      {e.by ? ` · ${e.by.name}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default AssetDrawer;

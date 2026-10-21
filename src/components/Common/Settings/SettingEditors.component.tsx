import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { AwardCatalogEntry } from '@app-types/api.types';
import { attendanceApi } from '@services/api/attendance.api';
import { concernsApi } from '@services/api/concerns.api';

/*
 * One editor per setting VALUE SHAPE. Each keeps a string draft, converts on
 * submit and calls onSave; `children` is the card's Save button, rendered
 * inside the form. The backend registry is the real validation.
 */

const inputClass = 'rounded-md border border-slate-300 px-3 py-2 text-sm';

export type Save = (value: unknown) => void;

interface EditorProps<T> {
  value: T;
  onSave: Save;
  children: ReactNode;
}

/** Labels for the fields inside object-shaped settings. */
const FIELD_LABELS: Record<string, string> = {
  earned: 'Earned leave',
  vacation_family: 'Vacation / family',
  amount: 'Amount (₹/month)',
  salaryFloor: 'Applies from salary (₹)',
  noticeDays: 'Notice period (days)',
  probationMonths: 'Probation (months)',
  leaves: 'Leave requests',
  remote: 'Remote-work requests',
  minMonthsInBand: 'Months in current band',
  minAttainment: "Last quarter's attainment (%)",
  cooldownDays: 'Wait after a closed conversation (days)',
  companyName: 'Company name',
  address: 'Address',
  l1Decide: 'Dispute L1 — manager decides in',
  l2Ack: 'Dispute L2 — HR acknowledges in',
  l2Decide: 'Dispute L2 — HR decides in',
  l3Decide: 'Dispute L3 — committee decides in',
  escalateWithin: 'Escalate within (after a decision)',
  complaintAck: 'Complaint — acknowledge in',
  complaintResolveCalendarDays: 'Complaint — outcome in (calendar days)',
  vigilAck: 'Whistleblower — acknowledge in',
  vigilResolveCalendarDays: 'Whistleblower — outcome in (calendar days)',
  contact: 'Contact (name, email or phone)',
};

const SATURDAY_LABELS: Record<string, string> = {
  all_working: 'All Saturdays working',
  all_off: 'All Saturdays off',
  first_third_off: '1st & 3rd Saturdays off',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  earned: 'Earned leave',
  sick: 'Sick leave',
};

const CADENCES: AwardCatalogEntry['cadence'][] = ['any', 'monthly', 'quarterly'];

export const NumberEditor = ({ value, onSave, children }: EditorProps<number>) => {
  const [draft, setDraft] = useState(String(value));
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(Number(draft));
      }}
      className='flex flex-wrap items-end gap-2'
    >
      <input
        required
        type='number'
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={`${inputClass} w-32`}
      />
      {children}
    </form>
  );
};

/** Several numbers; with `nullable`, a blank field saves as null ("not set"). */
export const NumberFieldsEditor = ({
  value,
  onSave,
  children,
  nullable = false,
}: EditorProps<Record<string, number | null>> & { nullable?: boolean }) => {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v === null ? '' : String(v)])),
  );
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(
          Object.fromEntries(
            Object.entries(draft).map(([k, v]) => [
              k,
              nullable && v.trim() === '' ? null : Number(v),
            ]),
          ),
        );
      }}
      className='flex flex-wrap items-end gap-2'
    >
      {Object.keys(draft).map((field) => (
        <label key={field} className='text-xs text-slate-500'>
          {FIELD_LABELS[field] ?? field}
          <input
            required={!nullable}
            type='number'
            min={0}
            value={draft[field]}
            placeholder={nullable ? 'not set' : undefined}
            onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
            className={`${inputClass} mt-1 block w-36`}
          />
        </label>
      ))}
      {children}
    </form>
  );
};

export const WorkWeekEditor = ({
  value,
  onSave,
  children,
}: EditorProps<{ saturdays: string; effectiveFrom?: string }>) => {
  const [saturdays, setSaturdays] = useState(value.saturdays);
  const [effectiveFrom, setEffectiveFrom] = useState(value.effectiveFrom ?? '');
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave({ saturdays, effectiveFrom });
      }}
      className='flex flex-wrap items-end gap-2'
    >
      <select
        value={saturdays}
        onChange={(e) => setSaturdays(e.target.value)}
        className={inputClass}
      >
        {Object.entries(SATURDAY_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <label className='text-xs text-slate-500'>
        Applies from
        <input
          required
          type='date'
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          className={`${inputClass} mt-1 block`}
        />
      </label>
      {children}
    </form>
  );
};

export const WorkHoursEditor = ({
  value,
  onSave,
  children,
}: EditorProps<{ workStart: string; workEnd: string; graceMinutes: number }>) => {
  const [workStart, setWorkStart] = useState(value.workStart);
  const [workEnd, setWorkEnd] = useState(value.workEnd);
  const [grace, setGrace] = useState(String(value.graceMinutes));
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave({ workStart, workEnd, graceMinutes: Number(grace) });
      }}
      className='flex flex-wrap items-end gap-2'
    >
      <label className='text-xs text-slate-500'>
        Starts
        <input
          required
          type='time'
          value={workStart}
          onChange={(e) => setWorkStart(e.target.value)}
          className={`${inputClass} mt-1 block`}
        />
      </label>
      <label className='text-xs text-slate-500'>
        Ends
        <input
          required
          type='time'
          value={workEnd}
          onChange={(e) => setWorkEnd(e.target.value)}
          className={`${inputClass} mt-1 block`}
        />
      </label>
      <label className='text-xs text-slate-500'>
        Grace (minutes)
        <input
          required
          type='number'
          min={0}
          max={120}
          value={grace}
          onChange={(e) => setGrace(e.target.value)}
          className={`${inputClass} mt-1 block w-28`}
        />
      </label>
      {children}
    </form>
  );
};

/** Hour rules: the half-day and short-day limits and the date they apply from. */
export const HourRulesEditor = ({
  value,
  onSave,
  children,
}: EditorProps<{
  halfDayBelowHours: number;
  shortDayBelowHours: number;
  effectiveFrom: string;
}>) => {
  const [half, setHalf] = useState(String(value.halfDayBelowHours));
  const [short, setShort] = useState(String(value.shortDayBelowHours));
  const [effectiveFrom, setEffectiveFrom] = useState(value.effectiveFrom);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave({
          halfDayBelowHours: Number(half),
          shortDayBelowHours: Number(short),
          effectiveFrom,
        });
      }}
      className='flex flex-wrap items-end gap-2'
    >
      <label className='text-xs text-slate-500'>
        Half day below (hours)
        <input
          required
          type='number'
          min={0}
          max={12}
          step={0.5}
          value={half}
          onChange={(e) => setHalf(e.target.value)}
          className={`${inputClass} mt-1 block w-32`}
        />
      </label>
      <label className='text-xs text-slate-500'>
        Notify below (hours)
        <input
          required
          type='number'
          min={0}
          max={16}
          step={0.5}
          value={short}
          onChange={(e) => setShort(e.target.value)}
          className={`${inputClass} mt-1 block w-32`}
        />
      </label>
      <label className='text-xs text-slate-500'>
        Applies from
        <input
          required
          type='date'
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          className={`${inputClass} mt-1 block`}
        />
      </label>
      {children}
    </form>
  );
};

/** Free-text fields for an object of strings (e.g. the payslip header). */
export const TextFieldsEditor = ({
  value,
  onSave,
  children,
}: EditorProps<Record<string, string>>) => {
  const [draft, setDraft] = useState(value);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])));
      }}
      className='flex flex-wrap items-end gap-2'
    >
      {Object.keys(draft).map((field) => (
        <label key={field} className='min-w-[16rem] flex-1 text-xs text-slate-500'>
          {FIELD_LABELS[field] ?? field}
          <input
            type='text'
            value={draft[field]}
            onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
            className={`${inputClass} mt-1 block w-full`}
          />
        </label>
      ))}
      {children}
    </form>
  );
};

/** On/off switches for an object of booleans. */
export const ToggleFieldsEditor = ({
  value,
  onSave,
  children,
}: EditorProps<Record<string, boolean>>) => {
  const [draft, setDraft] = useState(value);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(draft);
      }}
      className='flex flex-wrap items-center gap-4'
    >
      {Object.keys(draft).map((field) => (
        <label key={field} className='flex items-center gap-2 text-sm text-slate-600'>
          <input
            type='checkbox'
            checked={draft[field]}
            onChange={(e) => setDraft({ ...draft, [field]: e.target.checked })}
            className='h-4 w-4'
          />
          {FIELD_LABELS[field] ?? field}
        </label>
      ))}
      {children}
    </form>
  );
};

/** An ordered subset of leave types: checked ones are used, top first. */
export const OrderedLeaveTypesEditor = ({ value, onSave, children }: EditorProps<string[]>) => {
  const all = Object.keys(LEAVE_TYPE_LABELS);
  const [order, setOrder] = useState(() => [...value, ...all.filter((t) => !value.includes(t))]);
  const [on, setOn] = useState(() => new Set(value));

  const move = (i: number, by: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    setOrder(next);
  };
  const chosen = order.filter((t) => on.has(t));

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave(chosen);
      }}
      className='space-y-2'
    >
      <ol className='space-y-1'>
        {order.map((t, i) => (
          <li key={t} className='flex items-center gap-2 text-sm text-slate-600'>
            <input
              type='checkbox'
              checked={on.has(t)}
              onChange={(e) => {
                const next = new Set(on);
                if (e.target.checked) next.add(t);
                else next.delete(t);
                setOn(next);
              }}
              className='h-4 w-4'
            />
            <span className='w-28'>{LEAVE_TYPE_LABELS[t]}</span>
            <button
              type='button'
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className='text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30'
            >
              ↑
            </button>
            <button
              type='button'
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
              className='text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30'
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <div className='flex flex-wrap items-center gap-3'>
        <span className='text-xs text-slate-500'>
          {chosen.length === 0
            ? 'Nothing selected — every unmarked absent day becomes LOP.'
            : `Absence is covered from ${chosen.map((t) => LEAVE_TYPE_LABELS[t]).join(', then ')}; the rest is LOP.`}
        </span>
        {children}
      </div>
    </form>
  );
};

type PtSlab = { fromMonthly: number; amount: number; februaryAmount: number | null };
type PtState = { state: string; zoneNames: string[]; slabs: PtSlab[] };

/**
 * Professional tax by state: each state's punch-zone matchers (with a live
 * preview against the real zones) and its monthly slab table.
 */
export const PtStatesEditor = ({ value, onSave, children }: EditorProps<{ states: PtState[] }>) => {
  const [states, setStates] = useState<PtState[]>(value.states);
  const zones = useQuery({ queryKey: ['punch-zones'], queryFn: attendanceApi.listZones });
  const setState = (i: number, patch: Partial<PtState>) =>
    setStates(states.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const setSlab = (i: number, j: number, patch: Partial<PtSlab>) =>
    setState(i, { slabs: states[i]!.slabs.map((sl, k) => (k === j ? { ...sl, ...patch } : sl)) });
  const matchedZones = (names: string[]) =>
    (zones.data ?? [])
      .filter((z) => names.some((n) => n && z.name.toLowerCase().includes(n.toLowerCase())))
      .map((z) => z.name);

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave({
          states: states.map((st) => ({
            state: st.state.trim(),
            zoneNames: st.zoneNames.map((z) => z.trim()).filter((z) => z.length >= 2),
            slabs: st.slabs,
          })),
        });
      }}
      className='space-y-3'
    >
      {states.length === 0 && (
        <p className='text-xs text-slate-400'>No states — nobody pays professional tax.</p>
      )}
      {states.map((st, i) => {
        const matched = matchedZones(st.zoneNames);
        return (
          <div key={i} className='space-y-2 rounded-lg border border-slate-200 p-3'>
            <div className='flex flex-wrap items-end gap-2'>
              <label className='text-xs text-slate-500'>
                State
                <input
                  value={st.state}
                  onChange={(e) => setState(i, { state: e.target.value })}
                  className={`${inputClass} mt-1 block w-44`}
                />
              </label>
              <label className='min-w-[14rem] flex-1 text-xs text-slate-500'>
                Zones (names, or part of them — comma separated)
                <input
                  value={st.zoneNames.join(', ')}
                  onChange={(e) =>
                    setState(i, { zoneNames: e.target.value.split(',').map((z) => z.trimStart()) })
                  }
                  className={`${inputClass} mt-1 block w-full`}
                />
              </label>
              <button
                type='button'
                onClick={() => setStates(states.filter((_, idx) => idx !== i))}
                className='pb-2 text-xs text-red-500 hover:text-red-700'
              >
                Remove state
              </button>
            </div>
            <p className='text-xs text-slate-400'>
              {matched.length > 0
                ? `Matches: ${matched.join(', ')}`
                : 'Matches no punch zone yet — nobody is taxed here.'}
            </p>
            <table className='text-xs'>
              <thead>
                <tr className='text-slate-500'>
                  <th className='pr-2 text-left font-medium'>From salary (₹/mo)</th>
                  <th className='pr-2 text-left font-medium'>PT (₹/mo)</th>
                  <th className='pr-2 text-left font-medium'>February (blank = same)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {st.slabs.map((sl, j) => (
                  <tr key={j}>
                    {(['fromMonthly', 'amount'] as const).map((k) => (
                      <td key={k} className='pr-2 py-0.5'>
                        <input
                          type='number'
                          min={0}
                          value={sl[k]}
                          onChange={(e) => setSlab(i, j, { [k]: Number(e.target.value) })}
                          className={`${inputClass} w-28`}
                        />
                      </td>
                    ))}
                    <td className='pr-2 py-0.5'>
                      <input
                        type='number'
                        min={0}
                        value={sl.februaryAmount ?? ''}
                        onChange={(e) =>
                          setSlab(i, j, {
                            februaryAmount: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className={`${inputClass} w-28`}
                      />
                    </td>
                    <td>
                      {st.slabs.length > 1 && (
                        <button
                          type='button'
                          onClick={() => setState(i, { slabs: st.slabs.filter((_, k) => k !== j) })}
                          className='text-slate-400 hover:text-red-600'
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type='button'
              onClick={() =>
                setState(i, {
                  slabs: [...st.slabs, { fromMonthly: 0, amount: 0, februaryAmount: null }],
                })
              }
              className='text-xs text-brand-600 hover:underline'
            >
              + slab
            </button>
          </div>
        );
      })}
      <div className='flex flex-wrap items-center gap-3'>
        <button
          type='button'
          onClick={() =>
            setStates([
              ...states,
              {
                state: '',
                zoneNames: [],
                slabs: [{ fromMonthly: 0, amount: 0, februaryAmount: null }],
              },
            ])
          }
          className='rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50'
        >
          + state
        </button>
        {children}
      </div>
    </form>
  );
};

interface AwardRow {
  code: string;
  name: string;
  cadence: AwardCatalogEntry['cadence'];
  valueInr: string;
  team: boolean;
  /** Existing codes are fixed — nominations reference them. */
  isNew: boolean;
}

export const AwardCatalogEditor = ({
  value,
  onSave,
  children,
}: EditorProps<Record<string, AwardCatalogEntry>>) => {
  const [rows, setRows] = useState<AwardRow[]>(() =>
    Object.entries(value).map(([code, a]) => ({
      ...a,
      code,
      valueInr: String(a.valueInr),
      team: a.team ?? false,
      isNew: false,
    })),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const patch = (i: number, p: Partial<AwardRow>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const codes = rows.map((r) => r.code.trim());
    if (new Set(codes).size !== codes.length) {
      setLocalError('Two awards share a code — codes must be unique.');
      return;
    }
    setLocalError(null);
    onSave(
      Object.fromEntries(
        rows.map((r) => [
          r.code.trim(),
          {
            name: r.name.trim(),
            cadence: r.cadence,
            valueInr: Number(r.valueInr),
            team: r.team,
          },
        ]),
      ),
    );
  };

  return (
    <form onSubmit={submit} className='space-y-2'>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-left text-xs text-slate-400'>
              <th className='pb-1 font-normal'>Code</th>
              <th className='pb-1 font-normal'>Name</th>
              <th className='pb-1 font-normal'>Cadence</th>
              <th className='pb-1 font-normal'>Value (₹)</th>
              <th
                className='pb-1 font-normal'
                title='Can go to several people; the value is split equally'
              >
                Team
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className='py-1 pr-2'>
                  {r.isNew ? (
                    <input
                      required
                      pattern='[a-z][a-z0-9_]{1,30}'
                      title='lowercase letters, digits and _ (e.g. spot_award)'
                      value={r.code}
                      onChange={(e) => patch(i, { code: e.target.value })}
                      placeholder='spot_award'
                      className={`${inputClass} w-36 font-mono`}
                    />
                  ) : (
                    <span className='font-mono text-xs text-slate-500'>{r.code}</span>
                  )}
                </td>
                <td className='py-1 pr-2'>
                  <input
                    required
                    minLength={2}
                    maxLength={60}
                    value={r.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    className={`${inputClass} w-full min-w-40`}
                  />
                </td>
                <td className='py-1 pr-2'>
                  <select
                    value={r.cadence}
                    onChange={(e) => patch(i, { cadence: e.target.value as AwardRow['cadence'] })}
                    className={inputClass}
                  >
                    {CADENCES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className='py-1 pr-2'>
                  <input
                    required
                    type='number'
                    min={0}
                    value={r.valueInr}
                    onChange={(e) => patch(i, { valueInr: e.target.value })}
                    className={`${inputClass} w-32`}
                  />
                </td>
                <td className='py-1 pr-2 text-center'>
                  <input
                    type='checkbox'
                    aria-label='Team award'
                    checked={r.team}
                    onChange={(e) => patch(i, { team: e.target.checked })}
                    className='h-4 w-4'
                  />
                </td>
                <td className='py-1 text-right'>
                  <button
                    type='button'
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    className='text-xs text-slate-400 hover:text-red-600'
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <button
          type='button'
          onClick={() =>
            setRows([
              ...rows,
              { code: '', name: '', cadence: 'any', valueInr: '0', team: false, isNew: true },
            ])
          }
          className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
        >
          + Add award
        </button>
        {children}
      </div>
      {localError && <p className='text-sm text-red-600'>{localError}</p>}
    </form>
  );
};

/** A list of people (e.g. the Management Review Committee), picked by name. */
export const PeopleListEditor = ({
  value,
  onSave,
  children,
}: EditorProps<{ employeeIds: string[] }>) => {
  const [ids, setIds] = useState(value.employeeIds);
  const [pick, setPick] = useState('');
  const directory = useQuery({
    queryKey: ['concern-people'],
    queryFn: concernsApi.people,
    staleTime: 5 * 60_000,
  });
  const people = directory.data ?? [];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Unknown person';
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave({ employeeIds: ids });
      }}
      className='space-y-2'
    >
      {ids.length === 0 && <p className='text-xs text-slate-400'>Nobody yet.</p>}
      <ul className='flex flex-wrap gap-2'>
        {ids.map((id) => (
          <li
            key={id}
            className='flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700'
          >
            {nameOf(id)}
            <button
              type='button'
              onClick={() => setIds(ids.filter((x) => x !== id))}
              className='text-slate-400 hover:text-red-600'
              aria-label={`Remove ${nameOf(id)}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className='flex flex-wrap items-end gap-2'>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className={`${inputClass} min-w-[16rem]`}
        >
          <option value=''>Add a person…</option>
          {people
            .filter((p) => !ids.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.employeeCode}
              </option>
            ))}
        </select>
        <button
          type='button'
          disabled={!pick}
          onClick={() => {
            setIds([...ids, pick]);
            setPick('');
          }}
          className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40'
        >
          Add
        </button>
        {children}
      </div>
    </form>
  );
};

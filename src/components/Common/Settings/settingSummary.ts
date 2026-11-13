import { FIELD_LABELS, LEAVE_TYPE_LABELS, SATURDAY_LABELS } from './settingLabels';

/** "graceMinutes" → "Grace minutes" — the fallback for fields without a label. */
const humanize = (key: string): string => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const fieldLabel = (key: string) => FIELD_LABELS[key] ?? LEAVE_TYPE_LABELS[key] ?? humanize(key);

const scalar = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  if (typeof v === 'string') return LEAVE_TYPE_LABELS[v] ?? SATURDAY_LABELS[v] ?? v;
  if (Array.isArray(v)) return v.length === 0 ? 'none' : `${v.length} item${v.length === 1 ? '' : 's'}`;
  return `${Object.keys(v as object).length} entries`;
};

/**
 * A setting's current value in plain words for the compact settings row —
 * e.g. "1st & 3rd Saturdays off from 2026-01-01" or "Earned leave: 15 · Vacation / family: 7".
 * Long values are cut; the editor (Edit) shows everything.
 */
export const settingSummary = (key: string, value: unknown): string => {
  let text: string;
  if (key === 'attendance.workWeek' && value && typeof value === 'object') {
    const v = value as { saturdays?: string; effectiveFrom?: string };
    text = `${SATURDAY_LABELS[v.saturdays ?? ''] ?? v.saturdays ?? '—'}${v.effectiveFrom ? ` from ${v.effectiveFrom}` : ''}`;
  } else if (key === 'attendance.workHours' && value && typeof value === 'object') {
    const v = value as { workStart?: string; workEnd?: string; graceMinutes?: number };
    text = `${v.workStart ?? '—'}–${v.workEnd ?? '—'}, grace ${v.graceMinutes ?? 0} min`;
  } else if (key === 'payroll.autoCoverLeaveTypes' && Array.isArray(value)) {
    text = value.length ? value.map((t) => LEAVE_TYPE_LABELS[t as string] ?? t).join(', then ') : 'No auto-cover';
  } else if (Array.isArray(value)) {
    text = scalar(value);
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    text = entries.length
      ? entries.map(([k, v]) => `${fieldLabel(k)}: ${scalar(v)}`).join(' · ')
      : '—';
  } else {
    text = scalar(value);
  }
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
};

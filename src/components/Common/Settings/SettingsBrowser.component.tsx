import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { OrgSetting, SettingArea } from '@app-types/api.types';
import { settingsApi } from '@services/api/settings.api';
import { apiErrorMessage } from '@utils/apiError';

import { SettingCard } from './SettingCard.component';
import { settingSummary } from './settingSummary';

const AREA_TITLES: Record<SettingArea, string> = {
  people: 'People & growth',
  leaves: 'Leave',
  attendance: 'Attendance',
  payroll: 'Payroll',
  ops: 'Operations',
  access: 'Access',
};
const AREA_ORDER: SettingArea[] = ['people', 'leaves', 'attendance', 'payroll', 'ops', 'access'];

/** One setting as a compact row: name, one line, its value in words; Edit opens the editor. */
const SettingRow = ({ setting }: { setting: OrgSetting }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className='border-b border-slate-100 last:border-0'>
      <div className='flex flex-wrap items-start justify-between gap-3 py-3'>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='font-medium text-slate-800'>{setting.label}</span>
            {!setting.isDefault && (
              <span className='rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700'>
                changed
              </span>
            )}
            {!setting.live && (
              <span
                title='No feature reads this setting yet — saving stores it for later.'
                className='rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700'
              >
                not wired yet
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-xs text-slate-500 ${open ? '' : 'line-clamp-1'}`}>
            {setting.description}
          </p>
          {!open && (
            <p className='mt-1 text-sm text-slate-700'>{settingSummary(setting.key, setting.value)}</p>
          )}
        </div>
        <button
          type='button'
          onClick={() => setOpen(!open)}
          className='shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
        >
          {open ? 'Close' : setting.canEdit ? 'Edit' : 'View'}
        </button>
      </div>
      {open && (
        <div className='pb-4'>
          {/* Remount on save so the editor's draft re-seeds from the stored value. */}
          <SettingCard key={`${setting.key}:${setting.updatedAt ?? 'default'}`} setting={setting} bare />
        </div>
      )}
    </div>
  );
};

/**
 * Settings, one area at a time (learner, 2026-11-05 — the long single list was
 * "a very bad UI"): a list of areas on the left (chips on phones), a search
 * across every setting, and compact rows showing each value in words.
 * `areas` limits which areas appear (HR sees its own); `extra` adds sections
 * that aren't settings (Admin's Background jobs). The server filters by
 * rights, so an area the person can't read never shows.
 */
export const SettingsBrowser = ({
  areas,
  extra = [],
}: {
  areas?: SettingArea[];
  extra?: { key: string; title: string; node: ReactNode }[];
}) => {
  const settings = useQuery({ queryKey: ['org-settings', 'all'], queryFn: () => settingsApi.list() });
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  if (settings.error) {
    return <p className='text-sm text-red-600'>{apiErrorMessage(settings.error)}</p>;
  }
  if (settings.isLoading || !settings.data) {
    return <p className='text-sm text-slate-400'>Loading…</p>;
  }

  const visible = settings.data.filter((s) => !areas || areas.includes(s.area));
  const present = AREA_ORDER.filter((a) => visible.some((s) => s.area === a));
  const sections = [
    ...present.map((a) => ({
      key: a as string,
      title: AREA_TITLES[a],
      count: visible.filter((s) => s.area === a).length,
    })),
    ...extra.map((e) => ({ key: e.key, title: e.title, count: null as number | null })),
  ];
  if (sections.length === 0) {
    return <p className='text-sm text-slate-500'>You don&rsquo;t have access to any settings here.</p>;
  }
  const current = sections.some((s) => s.key === selected) ? selected! : sections[0]!.key;
  const q = search.trim().toLowerCase();
  const found = q
    ? visible.filter((s) => `${s.label} ${s.description}`.toLowerCase().includes(q))
    : null;
  const extraNode = extra.find((e) => e.key === current)?.node;
  const rows = found ?? visible.filter((s) => s.area === current);

  const sectionBtn = (on: boolean) =>
    `flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
      on ? 'bg-brand-50 font-medium text-brand-600' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className='flex flex-col gap-4 md:flex-row'>
      <aside className='shrink-0 space-y-3 md:w-56'>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search settings'
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
        />
        <nav className='flex gap-1 overflow-x-auto md:block md:space-y-1'>
          {sections.map((s) => (
            <button
              key={s.key}
              type='button'
              onClick={() => {
                setSelected(s.key);
                setSearch('');
              }}
              className={`${sectionBtn(!q && current === s.key)} shrink-0 md:shrink`}
            >
              {s.title}
              {s.count !== null && <span className='ml-2 text-xs text-slate-400'>{s.count}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <section className='min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-5 py-2'>
        {found ? (
          <p className='py-3 text-xs text-slate-400'>
            {found.length} setting{found.length === 1 ? '' : 's'} match &ldquo;{search.trim()}&rdquo;
          </p>
        ) : (
          !extraNode && (
            <h2 className='pt-3 text-sm font-semibold text-slate-700'>
              {sections.find((s) => s.key === current)?.title}
            </h2>
          )
        )}
        {!found && extraNode ? (
          <div className='py-3'>{extraNode}</div>
        ) : (
          rows.map((s) => <SettingRow key={s.key} setting={s} />)
        )}
        {found && found.length === 0 && (
          <p className='pb-3 text-sm text-slate-500'>Nothing matches.</p>
        )}
      </section>
    </div>
  );
};

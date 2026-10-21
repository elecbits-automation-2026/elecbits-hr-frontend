import { useQuery } from '@tanstack/react-query';

import type { OrgSetting, SettingArea } from '@app-types/api.types';
import { settingsApi } from '@services/api/settings.api';
import { apiErrorMessage } from '@utils/apiError';

import { SettingCard } from './SettingCard.component';

const AREA_TITLES: Record<SettingArea, string> = {
  payroll: 'Payroll',
  attendance: 'Attendance',
  leaves: 'Leaves',
  people: 'People & growth',
  ops: 'Operations',
  access: 'Access',
};

const Cards = ({ settings }: { settings: OrgSetting[] }) => (
  <div className='space-y-3'>
    {settings.map((s) => (
      // Remount on save so the editor's draft re-seeds from the stored value.
      <SettingCard key={`${s.key}:${s.updatedAt ?? 'default'}`} setting={s} />
    ))}
  </div>
);

/**
 * The settings the caller may read — one area, or all of them grouped by area.
 * The server filters by rights, so the same list serves Admin, Payroll and HR.
 * `title` + `hideWhenEmpty` let a page stack several area sections and drop
 * the ones the person can't see.
 */
export const SettingsList = ({
  area,
  groupByArea = false,
  title,
  hideWhenEmpty = false,
}: {
  area?: SettingArea;
  groupByArea?: boolean;
  title?: string;
  hideWhenEmpty?: boolean;
}) => {
  const settings = useQuery({
    queryKey: ['org-settings', area ?? 'all'],
    queryFn: () => settingsApi.list(area),
  });

  if (settings.error) {
    return <p className='text-sm text-red-600'>{apiErrorMessage(settings.error)}</p>;
  }
  if (settings.isLoading || !settings.data) {
    return hideWhenEmpty ? null : <p className='text-sm text-slate-400'>Loading…</p>;
  }
  if (settings.data.length === 0) {
    return hideWhenEmpty ? null : (
      <p className='text-sm text-slate-500'>You don&rsquo;t have access to any settings here.</p>
    );
  }

  const heading = (text: string) => (
    <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{text}</h2>
  );

  if (!groupByArea) {
    return (
      <section className='space-y-3'>
        {title && heading(title)}
        <Cards settings={settings.data} />
      </section>
    );
  }

  const areas = [...new Set(settings.data.map((s) => s.area))];
  return (
    <div className='space-y-6'>
      {areas.map((a) => (
        <section key={a} className='space-y-3'>
          {heading(AREA_TITLES[a])}
          <Cards settings={settings.data.filter((s) => s.area === a)} />
        </section>
      ))}
    </div>
  );
};

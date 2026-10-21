import type { OrgSetting, PublicSettings, SettingArea } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Org settings. The list carries only what the caller may read (access.settings
 * or the area's owning module), each with `canEdit`; PUT overrides one key and
 * the backend validates the value against that key's schema. Public values
 * (employee-side hints) are open to every signed-in user.
 */
export const settingsApi = {
  list: async (area?: SettingArea): Promise<OrgSetting[]> =>
    (await api.get<OrgSetting[]>('/settings', { params: { area } })).data,
  publicValues: async (): Promise<PublicSettings> =>
    (await api.get<PublicSettings>('/settings/public')).data,
  update: async ({ key, value }: { key: string; value: unknown }): Promise<OrgSetting> =>
    (await api.put<OrgSetting>(`/settings/${encodeURIComponent(key)}`, { value })).data,
};

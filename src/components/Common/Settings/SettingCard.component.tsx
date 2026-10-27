import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { AwardCatalogEntry, OrgSetting } from '@app-types/api.types';
import { settingsApi } from '@services/api/settings.api';
import { apiErrorMessage } from '@utils/apiError';

import {
  AwardCatalogEditor,
  DepartmentEditor,
  NumberEditor,
  NumberFieldsEditor,
  OrderedLeaveTypesEditor,
  PeopleListEditor,
  PtStatesEditor,
  ToggleFieldsEditor,
  HourRulesEditor,
  TextFieldsEditor,
  WorkHoursEditor,
  WorkWeekEditor,
  type Save,
} from './SettingEditors.component';

type EditorFor = (value: unknown, onSave: Save, saveButton: ReactNode) => ReactNode;

/**
 * Keys whose shape the generic editors can't infer from the value alone.
 * Everything else: a number gets NumberEditor, an object of numbers
 * NumberFieldsEditor.
 */
const EDITOR_BY_KEY: Record<string, EditorFor> = {
  'awards.catalog': (v, onSave, btn) => (
    <AwardCatalogEditor value={v as Record<string, AwardCatalogEntry>} onSave={onSave}>
      {btn}
    </AwardCatalogEditor>
  ),
  'attendance.workWeek': (v, onSave, btn) => (
    <WorkWeekEditor value={v as { saturdays: string; effectiveFrom?: string }} onSave={onSave}>
      {btn}
    </WorkWeekEditor>
  ),
  'attendance.workHours': (v, onSave, btn) => (
    <WorkHoursEditor
      value={v as { workStart: string; workEnd: string; graceMinutes: number }}
      onSave={onSave}
    >
      {btn}
    </WorkHoursEditor>
  ),
  'payroll.payslipHeader': (v, onSave, btn) => (
    <TextFieldsEditor value={v as Record<string, string>} onSave={onSave}>
      {btn}
    </TextFieldsEditor>
  ),
  'concerns.icContact': (v, onSave, btn) => (
    <TextFieldsEditor value={v as Record<string, string>} onSave={onSave}>
      {btn}
    </TextFieldsEditor>
  ),
  'hiring.hrDepartment': (v, onSave, btn) => (
    <DepartmentEditor value={v as { departmentId: string | null }} onSave={onSave}>
      {btn}
    </DepartmentEditor>
  ),
  'concerns.mrcMembers': (v, onSave, btn) => (
    <PeopleListEditor value={v as { employeeIds: string[] }} onSave={onSave}>
      {btn}
    </PeopleListEditor>
  ),
  'attendance.hourRules': (v, onSave, btn) => (
    <HourRulesEditor
      value={v as { halfDayBelowHours: number; shortDayBelowHours: number; effectiveFrom: string }}
      onSave={onSave}
    >
      {btn}
    </HourRulesEditor>
  ),
  'payroll.ptStates': (v, onSave, btn) => (
    <PtStatesEditor value={v as Parameters<typeof PtStatesEditor>[0]['value']} onSave={onSave}>
      {btn}
    </PtStatesEditor>
  ),
  'payroll.monthEndAutoApprove': (v, onSave, btn) => (
    <ToggleFieldsEditor value={v as Record<string, boolean>} onSave={onSave}>
      {btn}
    </ToggleFieldsEditor>
  ),
  'payroll.autoCoverLeaveTypes': (v, onSave, btn) => (
    <OrderedLeaveTypesEditor value={v as string[]} onSave={onSave}>
      {btn}
    </OrderedLeaveTypesEditor>
  ),
  'people.newHireDefaults': (v, onSave, btn) => (
    <NumberFieldsEditor value={v as Record<string, number | null>} onSave={onSave} nullable>
      {btn}
    </NumberFieldsEditor>
  ),
};

/**
 * One setting: label, description, badges and its editor. Without edit rights
 * the editor renders inside a disabled fieldset and the Save button is gone —
 * the value stays readable.
 */
export const SettingCard = ({ setting }: { setting: OrgSetting }) => {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings-public'] });
    },
  });
  const onSave: Save = (value) => save.mutate({ key: setting.key, value });

  const saveButton = setting.canEdit ? (
    <button
      type='submit'
      disabled={save.isPending}
      className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
    >
      Save
    </button>
  ) : null;

  const { key, value } = setting;
  const editor =
    EDITOR_BY_KEY[key]?.(value, onSave, saveButton) ??
    (typeof value === 'number' ? (
      <NumberEditor value={value} onSave={onSave}>
        {saveButton}
      </NumberEditor>
    ) : (
      <NumberFieldsEditor value={value as Record<string, number>} onSave={onSave}>
        {saveButton}
      </NumberFieldsEditor>
    ));

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div>
          <div className='font-medium text-slate-800'>{setting.label}</div>
          <p className='mt-0.5 text-sm text-slate-500'>{setting.description}</p>
        </div>
        <div className='flex gap-1.5'>
          {!setting.live && (
            <span
              title='No feature reads this setting yet — saving stores the value, which takes effect once the feature is wired.'
              className='rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700'
            >
              Not wired yet
            </span>
          )}
          {!setting.canEdit && (
            <span className='rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500'>
              View only
            </span>
          )}
          <span className='rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500'>
            {setting.isDefault ? 'Default' : 'Overridden'}
          </span>
        </div>
      </div>
      <fieldset disabled={!setting.canEdit} className='mt-3 min-w-0'>
        {editor}
      </fieldset>
      {save.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
      {!setting.isDefault && setting.updatedAt && (
        <p className='mt-2 text-xs text-slate-400'>
          Last changed {new Date(setting.updatedAt).toLocaleString()}
          {setting.updatedByName ? ` by ${setting.updatedByName}` : ''}
        </p>
      )}
    </div>
  );
};

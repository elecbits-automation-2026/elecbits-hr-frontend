import { SettingsList } from '@components/Common/Settings/SettingsList.component';

/**
 * HR settings: the attendance, leave and people knobs HR owns. Each section
 * shows only when the person holds that area's module (hrbp.attendance /
 * hrbp.leaves / hrbp.people); without update rights the cards are view-only.
 * Payroll settings live on the Payroll page; Admin sees everything.
 */
const HrSettingsPage = () => (
  <div className='w-full max-w-4xl space-y-6'>
    <div>
      <h1 className='text-2xl font-semibold text-slate-800'>HR settings</h1>
      <p className='mt-1 text-sm text-slate-500'>
        Org-wide rules for attendance, leave and people. Each uses its built-in default until
        changed; every change is recorded in the audit log.
      </p>
    </div>
    <SettingsList area='attendance' title='Attendance' hideWhenEmpty />
    <SettingsList area='leaves' title='Leaves' hideWhenEmpty />
    <SettingsList area='people' title='People & growth' hideWhenEmpty />
  </div>
);

export default HrSettingsPage;

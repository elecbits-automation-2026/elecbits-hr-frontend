import { SettingsBrowser } from '@components/Common/Settings/SettingsBrowser.component';

/**
 * HR settings: the attendance, leave and people knobs HR owns. Each section
 * shows only when the person holds that area's module (hrbp.attendance /
 * hrbp.leaves / hrbp.people); without update rights the cards are view-only.
 * Payroll settings live on the Payroll page; Admin sees everything.
 */
const HrSettingsPage = () => (
  <div className='w-full max-w-6xl space-y-6'>
    <div>
      <h1 className='text-2xl font-semibold text-slate-800'>HR settings</h1>
      <p className='mt-1 text-sm text-slate-500'>
        Org-wide rules for attendance, leave and people. Each uses its built-in default until
        changed; every change is recorded in the audit log.
      </p>
    </div>
    <SettingsBrowser areas={['people', 'leaves', 'attendance']} />
  </div>
);

export default HrSettingsPage;

import BackgroundJobs from '@components/Admin/BackgroundJobs.component';
import { SettingsBrowser } from '@components/Common/Settings/SettingsBrowser.component';

/**
 * Org settings (Admin): every org-tunable setting from the backend registry,
 * grouped by area. Payroll and HR edit their own areas from their consoles
 * too; Admin sees and edits all of them. Each falls back to its built-in
 * default until overridden; every save is validated server-side and audited.
 * Structural policy (leave quotas, payroll percentages, tax slabs) stays in
 * code and is deliberately not here.
 */
const OrgSettingsPage = () => (
  <div className='w-full max-w-6xl space-y-4'>
    <div>
      <h1 className='text-2xl font-semibold text-slate-800'>Org settings</h1>
      <p className='text-sm text-slate-500'>
        Pick an area, or search. Each setting uses its built-in default until changed
        (<b>changed</b> marks the ones that aren&rsquo;t); every change is recorded in the audit
        log. Payroll and HR can also edit their own areas from their consoles.
      </p>
    </div>
    <SettingsBrowser extra={[{ key: 'jobs', title: 'Background jobs', node: <BackgroundJobs /> }]} />
  </div>
);

export default OrgSettingsPage;

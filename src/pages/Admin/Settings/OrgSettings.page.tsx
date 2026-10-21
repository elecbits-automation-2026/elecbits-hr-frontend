import BackgroundJobs from '@components/Admin/BackgroundJobs.component';
import { SettingsList } from '@components/Common/Settings/SettingsList.component';

/**
 * Org settings (Admin): every org-tunable setting from the backend registry,
 * grouped by area. Payroll and HR edit their own areas from their consoles
 * too; Admin sees and edits all of them. Each falls back to its built-in
 * default until overridden; every save is validated server-side and audited.
 * Structural policy (leave quotas, payroll percentages, tax slabs) stays in
 * code and is deliberately not here.
 */
const OrgSettingsPage = () => (
  <div className='w-full max-w-4xl space-y-4'>
    <h1 className='text-2xl font-semibold text-slate-800'>Org settings</h1>
    <p className='text-sm text-slate-500'>
      Org-wide knobs. Each one uses its built-in default until you change it; every change is
      recorded in the audit log. Payroll and HR can also edit their own sections from their
      consoles. Settings marked <b>Not wired yet</b> are stored but have no effect until their
      feature starts reading them.
    </p>
    <BackgroundJobs />
    <SettingsList groupByArea />
  </div>
);

export default OrgSettingsPage;

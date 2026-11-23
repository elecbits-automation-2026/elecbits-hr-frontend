import { useQuery } from '@tanstack/react-query';

import { privacyApi } from '@services/api/privacy.api';
import { apiErrorMessage } from '@utils/apiError';

const Row = ({ label, count, cutoff }: { label: string; count: number; cutoff: string }) => (
  <tr className='border-t border-slate-100'>
    <th scope='row' className='py-2 pr-4 text-left font-normal text-slate-700'>
      {label}
    </th>
    <td className='py-2 pr-4 text-slate-600'>before {cutoff}</td>
    <td className='py-2 text-right font-semibold tabular-nums text-slate-800'>{count}</td>
  </tr>
);

/**
 * Data privacy (Admin, DPDP Act 2023): the retention periods in force, whether
 * the automatic purge is on, and what it would remove today — so the Admin
 * can check the numbers before switching the purge on. The periods and the
 * switch are the `privacy.retention` / `privacy.purge` settings; the notice
 * text is `privacy.notice`; sensitive reads show in the audit log as
 * `sensitive.read`.
 */
const DataPrivacy = () => {
  const preview = useQuery({
    queryKey: ['admin-privacy-retention'],
    queryFn: privacyApi.retention,
  });
  const p = preview.data;

  return (
    <section
      aria-labelledby='data-privacy-title'
      className='rounded-xl border border-slate-200 bg-white p-5'
    >
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 id='data-privacy-title' className='text-sm font-semibold text-slate-700'>
          Data privacy
        </h2>
        {p && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              p.purgeEnabled ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Automatic purge {p.purgeEnabled ? 'on' : 'off'}
          </span>
        )}
      </div>
      {preview.error && (
        <p role='alert' className='mt-2 text-sm text-red-700'>
          {apiErrorMessage(preview.error)}
        </p>
      )}
      {p && (
        <>
          <p className='mt-2 text-sm text-slate-600'>
            What the privacy-retention job would remove today
            {p.purgeEnabled ? '' : ' if the purge were on'}. Payroll, tax and PF records are never
            removed. Change the periods in <b>Data retention periods</b> and switch the purge in{' '}
            <b>Automatic data purge</b>.
          </p>
          <table className='mt-3 w-full text-sm'>
            <thead>
              <tr className='text-xs text-slate-600'>
                <th scope='col' className='pb-1 text-left font-medium'>
                  Data
                </th>
                <th scope='col' className='pb-1 text-left font-medium'>
                  Older than
                </th>
                <th scope='col' className='pb-1 text-right font-medium'>
                  Records
                </th>
              </tr>
            </thead>
            <tbody>
              <Row
                label={`Check-in GPS locations (${p.periods.gpsMonths} months)`}
                count={p.wouldRemove.punchLocations}
                cutoff={p.cutoffs.gps}
              />
              <Row
                label={`Medical certificates (${p.periods.medicalCertificateMonths} months after the leave)`}
                count={p.wouldRemove.medicalCertificates}
                cutoff={p.cutoffs.medical}
              />
              <Row
                label={`Ex-employees’ personal contact details (${p.periods.exEmployeeYears} years after relieving)`}
                count={p.wouldRemove.exEmployeeContactRecords}
                cutoff={p.cutoffs.exEmployee}
              />
            </tbody>
          </table>
          <p className='mt-3 text-xs text-slate-600'>
            Every time someone opens another person&rsquo;s salary, bank details, payslip PDF or
            medical certificate it is recorded in the audit log as <code>sensitive.read</code>.
          </p>
        </>
      )}
    </section>
  );
};

export default DataPrivacy;

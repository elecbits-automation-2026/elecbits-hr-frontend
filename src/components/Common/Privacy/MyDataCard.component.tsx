import { useMutation, useQuery } from '@tanstack/react-query';

import { privacyApi } from '@services/api/privacy.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * "Your data" on My profile (DPDP Act 2023): download everything Elecbits HR
 * holds about you as one JSON file, and see which privacy-notice version you
 * accepted and when.
 */
const MyDataCard = () => {
  const status = useQuery({ queryKey: ['privacy-status'], queryFn: privacyApi.status });
  const download = useMutation({ mutationFn: privacyApi.downloadMyData });
  const accepted = status.data?.acceptedAt;

  return (
    <section
      aria-labelledby='my-data-title'
      className='rounded-xl border border-slate-200 bg-white p-5'
    >
      <h2 id='my-data-title' className='text-sm font-semibold text-slate-800'>
        Your data
      </h2>
      <p className='mt-1 text-sm text-slate-600'>
        Download a copy of everything Elecbits HR keeps about you: profile, leave, attendance,
        payslips, claims, goals and a list of the files you uploaded.
        {accepted && (
          <>
            {' '}
            You accepted privacy notice version {status.data?.acceptedVersion} on{' '}
            {new Date(accepted).toLocaleDateString()}.
          </>
        )}
      </p>
      <div className='mt-3 flex flex-wrap items-center gap-3'>
        <button
          type='button'
          onClick={() => download.mutate()}
          disabled={download.isPending}
          className='rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'
        >
          {download.isPending ? 'Preparing…' : 'Download my data'}
        </button>
        {download.isSuccess && (
          <span role='status' className='text-sm text-green-700'>
            Downloaded.
          </span>
        )}
        {download.error && (
          <span role='alert' className='text-sm text-red-700'>
            {apiErrorMessage(download.error)}
          </span>
        )}
      </div>
    </section>
  );
};

export default MyDataCard;

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { AUTH_ROUTE } from '@constants/Common/navigation/routes.constants';
import { privacyApi } from '@services/api/privacy.api';
import { authService } from '@services/auth.service';
import { apiErrorMessage } from '@utils/apiError';

/**
 * The privacy notice gate (DPDP Act 2023): until the signed-in person has
 * accepted the CURRENT version of the notice, the app shows only the notice.
 * HR changes the version in Settings → Privacy notice to ask everyone again.
 * If the status can't be loaded the app stays usable — the gate must never
 * lock people out of their payslips because of a network blip.
 */
const PrivacyGate = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: ['privacy-status'],
    queryFn: privacyApi.status,
    staleTime: 5 * 60_000,
    // One quick retry, then fail open — don't hold a blank screen through backoff.
    retry: 1,
    retryDelay: 500,
  });
  const accept = useMutation({
    mutationFn: (version: string) => privacyApi.accept(version),
    onSuccess: (data) => queryClient.setQueryData(['privacy-status'], data),
    onError: () => queryClient.invalidateQueries({ queryKey: ['privacy-status'] }),
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const required = status.data?.required ?? false;

  useEffect(() => {
    if (required) headingRef.current?.focus();
  }, [required]);

  if (status.isLoading) return null;
  if (!status.data || !required) return <>{children}</>;

  const notice = status.data;
  return (
    <div className='flex min-h-screen items-start justify-center bg-slate-50 px-4 py-10'>
      <section
        aria-labelledby='privacy-title'
        className='w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm'
      >
        <h1
          id='privacy-title'
          ref={headingRef}
          tabIndex={-1}
          className='text-xl font-semibold text-slate-900 outline-none'
        >
          Before you continue: how we use your data
        </h1>
        <p className='mt-1 text-sm text-slate-600'>
          {notice.acceptedVersion
            ? 'The privacy notice has been updated. Please read the new version.'
            : 'Please read this once. It explains what Elecbits HR keeps about you and your rights.'}
        </p>
        <div
          tabIndex={0}
          aria-label='Privacy notice text'
          className='mt-4 max-h-[55vh] overflow-y-auto whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700'
        >
          {notice.text}
        </div>
        <p className='mt-2 text-xs text-slate-600'>Version {notice.version}</p>
        {accept.error && (
          <p role='alert' className='mt-3 text-sm text-red-700'>
            {apiErrorMessage(accept.error)}
          </p>
        )}
        <div className='mt-5 flex flex-wrap justify-end gap-2'>
          <button
            type='button'
            onClick={() => {
              authService.logout();
              navigate(AUTH_ROUTE, { replace: true });
            }}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50'
          >
            Sign out
          </button>
          <button
            type='button'
            disabled={accept.isPending}
            onClick={() => accept.mutate(notice.version)}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {accept.isPending ? 'Saving…' : 'I have read this and accept'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default PrivacyGate;

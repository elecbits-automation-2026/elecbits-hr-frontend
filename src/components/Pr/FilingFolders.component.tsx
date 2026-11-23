import { useQuery } from '@tanstack/react-query';

import { settingsApi } from '@services/api/settings.api';
import { apiErrorMessage } from '@utils/apiError';

const FOLDERS: Array<{ field: 'pfEsic' | 'pt'; label: string }> = [
  { field: 'pfEsic', label: 'PF & ESIC' },
  { field: 'pt', label: 'PT' },
];

/** Only https links are opened — the server refuses anything else, this is the second check. */
const safeLink = (v: unknown): string | null =>
  typeof v === 'string' && /^https:\/\//i.test(v.trim()) ? v.trim() : null;

/**
 * Payroll → Statutory, "Where the proofs live" (old tool parity): filed returns
 * and paid challans are kept in Drive, not here. The folder links come from the
 * payroll.filingFolders setting (Payroll → Settings).
 */
const FilingFolders = () => {
  const settings = useQuery({
    queryKey: ['org-settings', 'payroll'],
    queryFn: () => settingsApi.list('payroll'),
  });
  const setting = settings.data?.find((s) => s.key === 'payroll.filingFolders');
  const value = (setting?.value ?? {}) as Record<string, unknown>;
  const links = FOLDERS.map((f) => ({ ...f, href: safeLink(value[f.field]) }));
  const anySet = links.some((l) => l.href);

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5'>
      <h2 className='text-sm font-semibold text-slate-800'>Where the proofs live</h2>
      <p className='mt-1 text-sm text-slate-500'>
        Filed returns and paid challans are not stored in the HRMS. They are kept in these Drive
        folders.
      </p>
      {settings.isLoading && <p className='mt-3 text-sm text-slate-500'>Loading…</p>}
      {settings.error && (
        <p className='mt-3 text-sm text-red-600'>{apiErrorMessage(settings.error)}</p>
      )}
      {settings.data &&
        (anySet ? (
          <div className='mt-3 flex flex-wrap gap-2'>
            {links.map((l) =>
              l.href ? (
                <a
                  key={l.field}
                  href={l.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-slate-100'
                >
                  Open the {l.label} folder ↗
                </a>
              ) : (
                <span
                  key={l.field}
                  className='rounded-md border border-dashed border-slate-200 px-3 py-1.5 text-sm text-slate-500'
                >
                  {l.label} folder not set
                </span>
              ),
            )}
          </div>
        ) : (
          <p className='mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500'>
            No folder links yet.{' '}
            {setting?.canEdit
              ? 'Add them under Payroll → Settings → Where the proofs live.'
              : 'Ask whoever manages payroll settings to add them.'}
          </p>
        ))}
    </div>
  );
};

export default FilingFolders;

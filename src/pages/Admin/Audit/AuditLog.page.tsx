import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { accessApi } from '@services/api/access.api';
import { apiErrorMessage } from '@utils/apiError';

const pagerBtn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** The detail column is JSON text; show it as "key: value · …" when it parses. */
const detailText = (detail: string | null): string => {
  if (!detail) return '';
  try {
    const parsed: unknown = JSON.parse(detail);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' · ');
    }
    return String(parsed);
  } catch {
    return detail;
  }
};

/**
 * Audit log (Admin): every recorded change — access, settings, seats, people,
 * payroll, leaves… — newest first, with who did it. Entries are immutable
 * (design doc §10); this page only reads them.
 */
const PAGE_SIZES = [25, 50, 100, 200];

const AuditLogPage = () => {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const log = useQuery({
    queryKey: ['audit-log', search, page, pageSize],
    queryFn: () => accessApi.listAuditLog({ q: search || undefined, page, pageSize }),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(draft.trim());
    setPage(1);
  };

  const rows = log.data?.entries ?? [];
  const total = log.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className='w-full space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Audit log</h1>
        <p className='text-sm text-slate-500'>
          Every recorded change — who did what, to what, and when. Entries can't be edited or
          removed.
        </p>
      </div>

      <form onSubmit={submit} className='flex flex-wrap gap-2'>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Search action, subject, detail or person (e.g. seat, settings, Rahul)'
          className='min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm'
        />
        <button
          type='submit'
          className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
        >
          Search
        </button>
        {search && (
          <button
            type='button'
            onClick={() => {
              setDraft('');
              setSearch('');
              setPage(1);
            }}
            className='rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Clear
          </button>
        )}
      </form>

      {log.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
      {log.error && <p className='text-sm text-red-600'>{apiErrorMessage(log.error)}</p>}
      {log.data && rows.length === 0 && (
        <p className='text-sm text-slate-500'>
          {search ? `Nothing matches “${search}”.` : 'Nothing recorded yet.'}
        </p>
      )}

      {rows.length > 0 && (
        <div className='overflow-x-auto rounded-xl border border-slate-200 bg-white'>
          <table className='w-full text-left text-sm'>
            <thead className='border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500'>
              <tr>
                <th className='px-4 py-2 font-medium'>When</th>
                <th className='px-4 py-2 font-medium'>Who</th>
                <th className='px-4 py-2 font-medium'>Action</th>
                <th className='px-4 py-2 font-medium'>Subject</th>
                <th className='px-4 py-2 font-medium'>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className='border-b border-slate-100 align-top last:border-0'>
                  <td className='whitespace-nowrap px-4 py-2 text-slate-600'>{when(r.createdAt)}</td>
                  <td className='whitespace-nowrap px-4 py-2 text-slate-800'>
                    {r.actorName ?? <span className='text-slate-400'>System</span>}
                  </td>
                  <td className='whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-700'>
                    {r.action}
                  </td>
                  <td className='px-4 py-2 font-mono text-xs text-slate-500'>{r.subject}</td>
                  <td className='max-w-md break-words px-4 py-2 text-xs text-slate-600'>
                    {detailText(r.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className='flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600'>
          <span>
            {first}–{last} of {total}
          </span>
          <div className='flex flex-wrap items-center gap-2'>
            <label className='flex items-center gap-1 text-xs text-slate-500'>
              Per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className='rounded-md border border-slate-300 px-2 py-1 text-sm'
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type='button'
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className={pagerBtn}
            >
              « First
            </button>
            <button
              type='button'
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className={pagerBtn}
            >
              ‹ Previous
            </button>
            <span className='px-1 text-xs text-slate-500'>
              Page {page} of {pages}
            </span>
            <button
              type='button'
              disabled={page >= pages || log.isPlaceholderData}
              onClick={() => setPage(page + 1)}
              className={pagerBtn}
            >
              Next ›
            </button>
            <button
              type='button'
              disabled={page >= pages || log.isPlaceholderData}
              onClick={() => setPage(pages)}
              className={pagerBtn}
            >
              Last »
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;

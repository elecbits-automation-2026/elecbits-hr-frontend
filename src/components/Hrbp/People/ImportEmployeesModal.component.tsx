import { useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ImportEmployeeRow, ImportEmployeesResult } from '@app-types/api.types';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';
import { csvCell, downloadText, parseCsv } from '@utils/csv';

const TEMPLATE_HEADER = 'email,name,manager_email,level,date_of_joining,department,designation';
const TEMPLATE_EXAMPLE =
  'new.hire@elecbits.in,Asha Verma,rahul.manager@elecbits.in,L2,2026-11-03,Engineering,Firmware Engineer';

/** Header cell -> row field; spaces, underscores and case don't matter. */
const HEADER_FIELDS: Record<string, keyof ImportEmployeeRow> = {
  email: 'email',
  name: 'name',
  fullname: 'name',
  manageremail: 'managerEmail',
  manager: 'managerEmail',
  level: 'level',
  dateofjoining: 'dateOfJoining',
  joiningdate: 'dateOfJoining',
  doj: 'dateOfJoining',
  department: 'department',
  designation: 'designation',
};

/** CSV text -> import rows, or a message saying what's wrong with the header. */
const toRows = (text: string): { rows: ImportEmployeeRow[] } | { error: string } => {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header) return { error: 'The file is empty.' };
  const fields = header.map((h) => HEADER_FIELDS[h.toLowerCase().replace(/[\s_-]/g, '')]);
  const missing = (['email', 'name', 'managerEmail', 'level'] as const).filter(
    (f) => !fields.includes(f),
  );
  if (missing.length > 0) {
    return {
      error: `The header row is missing: ${missing.join(', ')}. Download the template to compare.`,
    };
  }
  if (body.length === 0) return { error: 'The file has a header but no people.' };
  if (body.length > 500) return { error: 'At most 500 people per file — split it up.' };
  return {
    rows: body.map((cells) => {
      const row: ImportEmployeeRow = { email: '', name: '', managerEmail: '', level: '' };
      fields.forEach((f, i) => {
        if (f) row[f] = (cells[i] ?? '').trim();
      });
      return row;
    }),
  };
};

/**
 * Bulk import (refinement plan, Phase 1): CSV in, a per-line check first,
 * then one all-or-nothing import. Everyone lands invited with only the
 * Employee batch; the claim links come back once, as a CSV to download.
 */
const ImportEmployeesModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportEmployeeRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportEmployeesResult | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => employeesApi.importEmployees({ dryRun, rows }),
    onSuccess: (result) => {
      setReport(result);
      if (!result.dryRun) {
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        queryClient.invalidateQueries({ queryKey: ['employees-incomplete'] });
      }
    },
  });

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setReport(null);
    run.reset();
    if (!file) return;
    setFileName(file.name);
    const parsed = toRows(await file.text());
    if ('error' in parsed) {
      setParseError(parsed.error);
      setRows([]);
    } else {
      setParseError(null);
      setRows(parsed.rows);
    }
  };

  const created = report && !report.dryRun ? report.created : [];
  const failing = report ? report.rows.filter((r) => r.errors.length > 0) : [];

  const exportLinks = () =>
    downloadText(
      'claim-links.csv',
      [
        'name,email,employee_code,claim_link,expires',
        ...created.map((c) =>
          [
            c.name,
            c.email,
            c.employeeCode,
            `${window.location.origin}/auth?claim=${c.claimToken}`,
            new Date(c.claimExpiresAt).toLocaleDateString(),
          ]
            .map(csvCell)
            .join(','),
        ),
      ].join('\n'),
    );

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='max-h-full w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>Import people from CSV</h2>
          <button
            type='button'
            onClick={onClose}
            className='text-sm text-slate-400 hover:text-slate-600'
          >
            ✕
          </button>
        </div>

        {created.length > 0 ? (
          <div className='space-y-3'>
            <p className='text-sm text-slate-700'>
              Imported {created.length} {created.length === 1 ? 'person' : 'people'}. Each is
              invited with only the Employee batch. Their claim links are shown once — download them
              now and send each person their own.
            </p>
            <ul className='max-h-56 overflow-y-auto rounded-md border border-slate-200 text-sm'>
              {created.map((c) => (
                <li
                  key={c.email}
                  className='flex justify-between gap-2 border-t border-slate-100 px-3 py-1.5 first:border-t-0'
                >
                  <span>{c.name}</span>
                  <span className='font-mono text-xs text-slate-400'>{c.employeeCode}</span>
                </li>
              ))}
            </ul>
            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={exportLinks}
                className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
              >
                Download claim links (CSV)
              </button>
              <button
                type='button'
                onClick={onClose}
                className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className='space-y-2 text-sm text-slate-600'>
              <p>
                One row per person. Required: <code className='text-xs'>email</code>,{' '}
                <code className='text-xs'>name</code>,{' '}
                <code className='text-xs'>manager_email</code>,{' '}
                <code className='text-xs'>level</code> (L1–L6). Optional:{' '}
                <code className='text-xs'>date_of_joining</code> (YYYY-MM-DD),{' '}
                <code className='text-xs'>department</code> (an existing name),{' '}
                <code className='text-xs'>designation</code>. A manager can be someone already in
                the system or another row in the file.
              </p>
              <button
                type='button'
                onClick={() =>
                  downloadText(
                    'people-import-template.csv',
                    `${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`,
                  )
                }
                className='text-xs text-brand-600 hover:underline'
              >
                Download the template
              </button>
            </div>

            <label className='block'>
              <span className='sr-only'>CSV file</span>
              <input
                type='file'
                accept='.csv,text/csv'
                onChange={pick}
                className='block w-full text-sm text-slate-600'
              />
            </label>
            {parseError && <p className='text-sm text-red-600'>{parseError}</p>}
            {rows.length > 0 && !report && (
              <p className='text-sm text-slate-500'>
                {fileName}: {rows.length} {rows.length === 1 ? 'person' : 'people'} found. Check the
                file first — nothing is written until you import.
              </p>
            )}

            {report && report.valid && report.dryRun && (
              <p className='rounded-md bg-green-50 px-3 py-2 text-sm text-green-700'>
                All {report.rows.length} rows are ready to import.
              </p>
            )}
            {failing.length > 0 && (
              <div className='space-y-1'>
                <p className='text-sm font-medium text-red-700'>
                  {failing.length} {failing.length === 1 ? 'row needs' : 'rows need'} fixing —
                  nothing was imported. Fix the file and check it again.
                </p>
                <div className='max-h-64 overflow-auto rounded-md border border-red-100'>
                  <table className='w-full text-left text-xs'>
                    <tbody>
                      {failing.map((r) => (
                        <tr
                          key={r.line}
                          className='border-t border-red-50 align-top first:border-t-0'
                        >
                          <td className='px-2 py-1.5 font-mono text-slate-400'>row {r.line}</td>
                          <td className='px-2 py-1.5 text-slate-700'>{r.email || r.name || '—'}</td>
                          <td className='px-2 py-1.5 text-red-700'>{r.errors.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {run.error && <p className='text-sm text-red-600'>{apiErrorMessage(run.error)}</p>}

            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                Cancel
              </button>
              {report?.valid && report.dryRun ? (
                <button
                  type='button'
                  disabled={run.isPending}
                  onClick={() => run.mutate(false)}
                  className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
                >
                  {run.isPending
                    ? 'Importing…'
                    : `Import ${rows.length} ${rows.length === 1 ? 'person' : 'people'}`}
                </button>
              ) : (
                <button
                  type='button'
                  disabled={rows.length === 0 || run.isPending}
                  onClick={() => run.mutate(true)}
                  className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
                >
                  {run.isPending ? 'Checking…' : 'Check the file'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportEmployeesModal;

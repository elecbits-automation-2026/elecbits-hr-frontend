import { useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ImportAssetRow, ImportAssetsResult } from '@app-types/api.types';
import { primaryBtn, secondaryBtn } from '@constants/Common/ops.constants';
import { opsApi } from '@services/api/ops.api';
import { apiErrorMessage } from '@utils/apiError';
import { downloadText, headerKey, parseCsv } from '@utils/csv';

const TEMPLATE_HEADER =
  'asset_code,name,category,zone,status,holder_email,loan_due_on,make,model,serial_no,purchased_on,purchase_cost,vendor,warranty_until,condition,notes';
const TEMPLATE_EXAMPLE =
  ',ThinkPad E14,Laptop,Gurugram office,,asha.eng@elecbits.in,,Lenovo,E14 Gen 5,PF4XYZ12,2026-04-02,68000,Croma,2029-04-01,good,';

const HEADER_FIELDS: Record<string, keyof ImportAssetRow> = {
  assetcode: 'assetCode',
  tag: 'assetCode',
  code: 'assetCode',
  name: 'name',
  category: 'category',
  zone: 'zone',
  location: 'zone',
  status: 'status',
  holderemail: 'holderEmail',
  holder: 'holderEmail',
  email: 'holderEmail',
  loandueon: 'loanDueOn',
  dueon: 'loanDueOn',
  make: 'make',
  brand: 'make',
  model: 'model',
  serialno: 'serialNo',
  serial: 'serialNo',
  purchasedon: 'purchasedOn',
  purchasecost: 'purchaseCost',
  cost: 'purchaseCost',
  vendor: 'vendor',
  warrantyuntil: 'warrantyUntil',
  warranty: 'warrantyUntil',
  condition: 'condition',
  notes: 'notes',
};

/** The columns the check screen lets you fix in place. */
const EDITABLE: { key: keyof ImportAssetRow; label: string; width: string }[] = [
  { key: 'name', label: 'Name', width: 'w-40' },
  { key: 'category', label: 'Category', width: 'w-28' },
  { key: 'zone', label: 'Zone', width: 'w-32' },
  { key: 'holderEmail', label: 'Holder email', width: 'w-48' },
  { key: 'status', label: 'Status', width: 'w-24' },
  { key: 'loanDueOn', label: 'Due back', width: 'w-28' },
  { key: 'purchasedOn', label: 'Purchased', width: 'w-28' },
  { key: 'assetCode', label: 'Tag', width: 'w-28' },
];

const toRows = (text: string): { rows: ImportAssetRow[] } | { error: string } => {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header) return { error: 'The file is empty.' };
  const fields = header.map((h) => HEADER_FIELDS[headerKey(h)]);
  const missing = (['name', 'category', 'zone'] as const).filter((f) => !fields.includes(f));
  if (missing.length) {
    return { error: `The header row is missing: ${missing.join(', ')}. Download the template.` };
  }
  if (body.length === 0) return { error: 'The file has a header but no assets.' };
  if (body.length > 1000) return { error: 'At most 1000 assets per file — split it up.' };
  return {
    rows: body.map((cells) => {
      const row: ImportAssetRow = {};
      fields.forEach((f, i) => {
        if (f) row[f] = (cells[i] ?? '').trim();
      });
      return row;
    }),
  };
};

/**
 * Bring the existing asset list in from a spreadsheet: parse, check every row
 * on the server, fix rows in place, check again, then one all-or-nothing
 * import. A row with a holder email is issued to that person straight away.
 */
const ImportAssetsModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ImportAssetRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<(ImportAssetsResult & { dryRun: boolean }) | null>(null);

  const run = useMutation({
    mutationFn: async (dryRun: boolean) => ({
      ...(await opsApi.importAssets({ rows, dryRun })),
      dryRun,
    }),
    onSuccess: (r) => {
      setReport(r);
      if (!r.dryRun && r.ok) queryClient.invalidateQueries({ queryKey: ['ops-assets'] });
    },
  });

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setReport(null);
    run.reset();
    if (!file) return;
    const parsed = toRows(await file.text());
    if ('error' in parsed) {
      setParseError(parsed.error);
      setRows([]);
    } else {
      setParseError(null);
      setRows(parsed.rows);
    }
  };

  const edit = (i: number, key: keyof ImportAssetRow, value: string) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
    // Any edit means the last check no longer holds.
    setReport((r) => (r ? { ...r, ok: false, dryRun: true } : r));
  };
  const errorsByRow = new Map((report?.errors ?? []).map((e) => [e.row, e.message]));
  const checkedOk = report?.ok && report.dryRun;
  const imported = report && !report.dryRun && report.ok ? report.created : 0;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='max-h-full w-full max-w-5xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-800'>Import assets from CSV</h2>
          <button
            type='button'
            onClick={onClose}
            className='text-sm text-slate-400 hover:text-slate-600'
          >
            ✕
          </button>
        </div>

        {imported > 0 ? (
          <div className='space-y-3'>
            <p className='text-sm text-slate-700'>
              Imported {imported} {imported === 1 ? 'asset' : 'assets'}. Anyone named as a holder
              has been told in their bell.
            </p>
            <div className='flex justify-end'>
              <button type='button' onClick={onClose} className={primaryBtn}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className='space-y-1 text-sm text-slate-600'>
              <p>
                One row per asset. Required: <code className='text-xs'>name</code>,{' '}
                <code className='text-xs'>category</code> (name or prefix, e.g. Laptop or LAP),{' '}
                <code className='text-xs'>zone</code> (a punch zone name). A blank{' '}
                <code className='text-xs'>asset_code</code> gets the next EB-tag. Add{' '}
                <code className='text-xs'>holder_email</code> to hand it to someone (lab items also
                need <code className='text-xs'>loan_due_on</code>). Dates are YYYY-MM-DD.
              </p>
              <button
                type='button'
                onClick={() =>
                  downloadText(
                    'assets-import-template.csv',
                    `${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`,
                  )
                }
                className='text-xs text-brand-600 hover:underline'
              >
                Download the template
              </button>
            </div>
            <input
              type='file'
              accept='.csv,text/csv'
              onChange={pick}
              className='block w-full text-sm text-slate-600'
            />
            {parseError && <p className='text-sm text-red-600'>{parseError}</p>}

            {rows.length > 0 && (
              <div className='max-h-[50vh] overflow-auto rounded-md border border-slate-200'>
                <table className='text-left text-xs'>
                  <thead className='sticky top-0 bg-slate-50 text-slate-500'>
                    <tr>
                      <th className='px-2 py-1.5'>#</th>
                      {EDITABLE.map((c) => (
                        <th key={c.key} className='px-2 py-1.5 font-medium'>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const err = errorsByRow.get(i + 1);
                      return (
                        <tr
                          key={i}
                          className={`border-t border-slate-100 align-top ${err ? 'bg-red-50/60' : ''}`}
                        >
                          <td className='px-2 py-1 font-mono text-slate-400'>{i + 1}</td>
                          {EDITABLE.map((c) => (
                            <td key={c.key} className='px-1 py-1'>
                              <input
                                value={r[c.key] ?? ''}
                                onChange={(e) => edit(i, c.key, e.target.value)}
                                className={`${c.width} rounded border border-slate-200 px-1.5 py-1 text-xs focus:border-brand-500 focus:outline-none`}
                              />
                              {c.key === 'name' && err && (
                                <p className='mt-0.5 w-72 text-red-700'>{err}</p>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {checkedOk && (
              <p className='rounded-md bg-green-50 px-3 py-2 text-sm text-green-700'>
                All {rows.length} rows are ready to import.
              </p>
            )}
            {report && report.errors.length > 0 && (
              <p className='text-sm font-medium text-red-700'>
                {report.errors.length} {report.errors.length === 1 ? 'row needs' : 'rows need'}{' '}
                fixing — nothing was imported. Fix them above and check again.
              </p>
            )}
            {run.error && <p className='text-sm text-red-600'>{apiErrorMessage(run.error)}</p>}

            <div className='flex justify-end gap-2'>
              <button type='button' onClick={onClose} className={secondaryBtn}>
                Cancel
              </button>
              {checkedOk ? (
                <button
                  type='button'
                  disabled={run.isPending}
                  onClick={() => run.mutate(false)}
                  className={primaryBtn}
                >
                  {run.isPending
                    ? 'Importing…'
                    : `Import ${rows.length} ${rows.length === 1 ? 'asset' : 'assets'}`}
                </button>
              ) : (
                <button
                  type='button'
                  disabled={rows.length === 0 || run.isPending}
                  onClick={() => run.mutate(true)}
                  className={primaryBtn}
                >
                  {run.isPending ? 'Checking…' : 'Check rows'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportAssetsModal;

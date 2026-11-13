import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ReimbursementClaim, ReimbursementStatus } from '@app-types/api.types';
import ClaimRow from '@components/Common/Reimbursements/ClaimRow.component';
import { inr } from '@constants/Common/reimbursements.constants';
import { reimbursementsApi } from '@services/api/reimbursements.api';
import { apiErrorMessage } from '@utils/apiError';

const today = () => new Date().toLocaleDateString('en-CA');

const tabBtn = (on: boolean) =>
  `rounded-full px-3 py-1 text-xs ${
    on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`;

const SHEET_VIEWS: Record<string, { label: string; statuses: ReimbursementStatus[] }> = {
  toPay: { label: 'To pay', statuses: ['approved'] },
  paid: { label: 'Paid', statuses: ['paid'] },
  closed: { label: 'Declined / withdrawn', statuses: ['declined', 'cancelled'] },
};

const sum = (claims: ReimbursementClaim[]) => claims.reduce((acc, c) => acc + c.amount, 0);

const INVALIDATE = [['reimbursement-desk']];

/**
 * PR's and the Admin account's reimbursement desk (learner, 2026-11-05).
 * "To decide": PR approves claims for Admin; Admin decides at either step and
 * an Admin approval is final. "Sheet": approved claims to pay — download the
 * bank file, pay by transfer, then tick them and mark paid with the date and
 * the bank reference. Claims are not on the payslip.
 */
const ReimbursementDesk = ({ role }: { role: 'pr' | 'admin' }) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'decide' | 'sheet'>('decide');
  const [sheetView, setSheetView] = useState<keyof typeof SHEET_VIEWS>('toPay');
  const [month, setMonth] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paidOn, setPaidOn] = useState(today());
  const [reference, setReference] = useState('');

  const decideStatuses: ReimbursementStatus[] =
    role === 'admin' ? ['pending_admin', 'pending_payroll'] : ['pending_payroll'];
  const waiting = useQuery({
    queryKey: ['reimbursement-desk', 'decide', role],
    queryFn: () => reimbursementsApi.queue({ statuses: decideStatuses }),
  });
  const sheet = useQuery({
    queryKey: ['reimbursement-desk', 'sheet', sheetView, month],
    queryFn: () =>
      reimbursementsApi.queue({
        statuses: SHEET_VIEWS[sheetView]!.statuses,
        month: month || undefined,
      }),
    enabled: tab === 'sheet',
  });
  // The totals strip always shows what is still to pay, whatever the view.
  const toPay = useQuery({
    queryKey: ['reimbursement-desk', 'sheet', 'toPay', month],
    queryFn: () => reimbursementsApi.queue({ statuses: ['approved'], month: month || undefined }),
  });

  const download = useMutation({
    mutationFn: () => reimbursementsApi.downloadBankFile(month || undefined),
  });
  const markPaid = useMutation({
    mutationFn: () =>
      reimbursementsApi.markPaid({
        claimIds: [...selected],
        paidOn,
        reference: reference.trim(),
      }),
    onSuccess: () => {
      setSelected(new Set());
      setReference('');
      INVALIDATE.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
    },
  });

  const forAdmin = (waiting.data ?? []).filter((c) => c.status === 'pending_admin');
  const notSeenByPr = (waiting.data ?? []).filter((c) => c.status === 'pending_payroll');
  const sheetRows = sheet.data ?? [];
  const selectable = sheetView === 'toPay';
  const pickedTotal = sum(sheetRows.filter((c) => selected.has(c.id)));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submitPaid = (e: FormEvent) => {
    e.preventDefault();
    if (selected.size > 0 && reference.trim().length >= 3) markPaid.mutate();
  };

  const list = (claims: ReimbursementClaim[], mode: 'approver' | 'view') => (
    <ul className='space-y-2'>
      {claims.map((c) => (
        <ClaimRow
          key={c.id}
          claim={c}
          mode={mode}
          showPerson
          invalidate={INVALIDATE}
          {...(selectable && tab === 'sheet'
            ? { selected: selected.has(c.id), onSelect: (on: boolean) => toggle(c.id, on) }
            : {})}
        />
      ))}
    </ul>
  );

  return (
    <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap gap-2'>
          <button type='button' onClick={() => setTab('decide')} className={tabBtn(tab === 'decide')}>
            To decide{waiting.data ? ` (${waiting.data.length})` : ''}
          </button>
          <button type='button' onClick={() => setTab('sheet')} className={tabBtn(tab === 'sheet')}>
            Reimbursement sheet
          </button>
        </div>
        {toPay.data && (
          <span className='text-xs text-slate-500'>
            To pay: <b className='text-slate-700'>{toPay.data.length}</b> claims ·{' '}
            <b className='text-slate-700'>{inr(sum(toPay.data))}</b>
            {month ? ` (approved in ${month})` : ''}
          </span>
        )}
      </div>

      {tab === 'decide' && (
        <>
          <p className='text-xs text-slate-400'>
            {role === 'admin'
              ? 'PR approves first, then you. You can also decide a claim PR hasn’t seen yet — your approval is final. A decline is final too.'
              : 'Approve claims for Admin, or decline them (final, with a reason). Your own claims go to Admin only. Claims are usually approved once a month.'}
          </p>
          {waiting.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
          {waiting.error && <p className='text-sm text-red-600'>{apiErrorMessage(waiting.error)}</p>}
          {waiting.data?.length === 0 && (
            <p className='text-sm text-slate-400'>Nothing waiting for you.</p>
          )}
          {role === 'admin' ? (
            <>
              {forAdmin.length > 0 && (
                <section className='space-y-2'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                    Approved by PR — waiting for you ({forAdmin.length} · {inr(sum(forAdmin))})
                  </h3>
                  {list(forAdmin, 'approver')}
                </section>
              )}
              {notSeenByPr.length > 0 && (
                <section className='space-y-2'>
                  <h3 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                    Still with PR ({notSeenByPr.length} · {inr(sum(notSeenByPr))})
                  </h3>
                  {list(notSeenByPr, 'approver')}
                </section>
              )}
            </>
          ) : (
            list(waiting.data ?? [], 'approver')
          )}
        </>
      )}

      {tab === 'sheet' && (
        <>
          <div className='flex flex-wrap items-end gap-3'>
            <div className='flex flex-wrap gap-2'>
              {Object.entries(SHEET_VIEWS).map(([k, v]) => (
                <button
                  key={k}
                  type='button'
                  onClick={() => {
                    setSheetView(k);
                    setSelected(new Set());
                  }}
                  className={tabBtn(sheetView === k)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <label className='text-xs text-slate-500'>
              Approved in
              <input
                type='month'
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setSelected(new Set());
                }}
                className='ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm'
              />
            </label>
            {month && (
              <button
                type='button'
                onClick={() => setMonth('')}
                className='text-xs text-slate-500 hover:underline'
              >
                All months
              </button>
            )}
            {sheetView === 'toPay' && (
              <button
                type='button'
                disabled={download.isPending || (toPay.data?.length ?? 0) === 0}
                onClick={() => download.mutate()}
                className='ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40'
              >
                {download.isPending ? 'Preparing…' : 'Download bank file (.xlsx)'}
              </button>
            )}
          </div>
          {download.error && (
            <p className='text-sm text-red-600'>{apiErrorMessage(download.error)}</p>
          )}
          {sheetView === 'toPay' && (
            <p className='text-xs text-slate-400'>
              The bank file has one row per person (name, account, IFSC, total, narration) and a
              second tab with every claim. After the transfer, tick the claims you paid and mark
              them paid with the bank reference.
            </p>
          )}

          {sheet.isLoading && <p className='text-sm text-slate-400'>Loading…</p>}
          {sheet.error && <p className='text-sm text-red-600'>{apiErrorMessage(sheet.error)}</p>}
          {sheet.data?.length === 0 && <p className='text-sm text-slate-400'>Nothing here.</p>}
          {sheetRows.length > 0 && (
            <p className='text-xs text-slate-500'>
              {sheetRows.length} claims · {inr(sum(sheetRows))}
              {selectable && (
                <>
                  {' · '}
                  <button
                    type='button'
                    onClick={() =>
                      setSelected(
                        selected.size === sheetRows.length
                          ? new Set()
                          : new Set(sheetRows.map((c) => c.id)),
                      )
                    }
                    className='text-brand-600 hover:underline'
                  >
                    {selected.size === sheetRows.length ? 'Clear selection' : 'Select all'}
                  </button>
                </>
              )}
            </p>
          )}
          {list(sheetRows, 'view')}

          {selectable && selected.size > 0 && (
            <form
              onSubmit={submitPaid}
              className='sticky bottom-0 flex flex-wrap items-end gap-3 rounded-lg border border-brand-500 bg-brand-50 p-3'
            >
              <span className='text-sm text-slate-700'>
                Mark <b>{selected.size}</b> claims paid · <b>{inr(pickedTotal)}</b>
              </span>
              <label className='text-xs text-slate-500'>
                Paid on
                <input
                  type='date'
                  max={today()}
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className='ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm'
                />
              </label>
              <label className='text-xs text-slate-500'>
                Bank reference (UTR)
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={100}
                  placeholder='e.g. UTR / batch number'
                  className='ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm'
                />
              </label>
              <button
                type='submit'
                disabled={markPaid.isPending || reference.trim().length < 3 || paidOn > today()}
                className='rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
              >
                {markPaid.isPending ? 'Saving…' : 'Mark paid'}
              </button>
              {markPaid.error && (
                <p className='w-full text-sm text-red-600'>{apiErrorMessage(markPaid.error)}</p>
              )}
            </form>
          )}
          {markPaid.data && (
            <p className='text-sm text-green-700'>
              Marked {markPaid.data.paid} claims paid ({inr(markPaid.data.total)}).
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default ReimbursementDesk;

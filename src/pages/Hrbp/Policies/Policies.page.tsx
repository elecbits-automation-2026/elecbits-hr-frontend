import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreatePolicyInput,
  Policy,
  PolicyCategory,
  UpdatePolicyInput,
} from '@app-types/api.types';
import { policiesApi } from '@services/api/policies.api';
import { apiErrorMessage } from '@utils/apiError';

const CATEGORIES: Array<{ value: PolicyCategory; label: string }> = [
  { value: 'conduct', label: 'Conduct' },
  { value: 'handbook', label: 'Handbook' },
  { value: 'performance', label: 'Performance' },
  { value: 'time', label: 'Time' },
  { value: 'culture', label: 'Culture' },
  { value: 'other', label: 'Other' },
];

interface Draft {
  code: string;
  title: string;
  category: PolicyCategory;
  version: string;
  ackRequired: boolean;
  summary: string;
  docUrl: string;
}

const emptyDraft = (): Draft => ({
  code: '',
  title: '',
  category: 'other',
  version: '2026.1',
  ackRequired: true,
  summary: '',
  docUrl: '',
});

const draftOf = (p: Policy): Draft => ({
  code: p.code,
  title: p.title,
  category: p.category,
  version: p.version,
  ackRequired: p.ackRequired,
  summary: p.summary ?? '',
  docUrl: p.docUrl ?? '',
});

/** Create/edit modal. Changing the version is called out as the re-ask act. */
const PolicyModal = ({ existing, onClose }: { existing: Policy | null; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(existing ? draftOf(existing) : emptyDraft());
  const [file, setFile] = useState<File | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const bumping = existing !== null && draft.version.trim() !== existing.version;

  const save = useMutation({
    mutationFn: async () => {
      const common = {
        title: draft.title.trim(),
        category: draft.category,
        version: draft.version.trim(),
        ackRequired: draft.ackRequired,
      };
      if (existing) {
        const input: UpdatePolicyInput = {
          ...common,
          summary: draft.summary.trim() || null,
          docUrl: draft.docUrl.trim() || null,
        };
        const updated = await policiesApi.update(existing.id, input);
        // Storing a PDF clears any external link server-side — our DB is
        // where the document lives from then on.
        return file ? policiesApi.uploadDocument(existing.id, file) : updated;
      }
      const input: CreatePolicyInput = {
        code: draft.code.trim(),
        ...common,
        ...(draft.summary.trim() ? { summary: draft.summary.trim() } : {}),
        ...(draft.docUrl.trim() ? { docUrl: draft.docUrl.trim() } : {}),
      };
      const created = await policiesApi.create(input);
      return file ? policiesApi.uploadDocument(created.id, file) : created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-policies'] });
      queryClient.invalidateQueries({ queryKey: ['hr-policy-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['my-policies'] });
      onClose();
    },
  });

  const valid = draft.title.trim().length >= 3 && draft.version.trim().length > 0 &&
    (existing !== null || /^[a-z0-9][a-z0-9_-]{1,39}$/.test(draft.code.trim()));

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='w-full max-w-lg rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>
          {existing ? `Edit “${existing.title}”` : 'Add a policy'}
        </h2>

        <div className='mt-4 space-y-3'>
          {!existing && (
            <label className='block text-sm'>
              <span className='text-slate-600'>Code (short handle, e.g. “coc” — fixed later)</span>
              <input
                value={draft.code}
                onChange={(e) => set('code', e.target.value.toLowerCase())}
                className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
                placeholder='coc'
              />
            </label>
          )}
          <label className='block text-sm'>
            <span className='text-slate-600'>Title</span>
            <input
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
            />
          </label>
          <div className='flex gap-3'>
            <label className='block flex-1 text-sm'>
              <span className='text-slate-600'>Category</span>
              <select
                value={draft.category}
                onChange={(e) => set('category', e.target.value as PolicyCategory)}
                className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className='block flex-1 text-sm'>
              <span className='text-slate-600'>Version</span>
              <input
                value={draft.version}
                onChange={(e) => set('version', e.target.value)}
                className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
              />
            </label>
          </div>
          {bumping && (
            <p className='rounded-md bg-amber-50 p-3 text-xs text-amber-700'>
              Version change {existing!.version} → {draft.version.trim()}: everyone will be asked
              to acknowledge again. Existing signatures stay on record as the old version.
            </p>
          )}
          <label className='block text-sm'>
            <span className='text-slate-600'>Summary (optional)</span>
            <textarea
              value={draft.summary}
              onChange={(e) => set('summary', e.target.value)}
              rows={2}
              className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
            />
          </label>
          <label className='block text-sm'>
            <span className='text-slate-600'>Document PDF (stored in the HRMS)</span>
            <input
              type='file'
              accept='application/pdf'
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className='mt-1 w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700'
            />
            {existing?.hasDocument && !file && (
              <span className='text-xs text-green-700'>
                A PDF is stored — choosing a file replaces it.
              </span>
            )}
            {file && <span className='text-xs text-slate-500'>Will store “{file.name}”.</span>}
          </label>
          <label className='block text-sm'>
            <span className='text-slate-600'>
              External link (fallback — ignored once a PDF is stored)
            </span>
            <input
              value={draft.docUrl}
              onChange={(e) => set('docUrl', e.target.value)}
              className='mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
              placeholder='https://…'
            />
          </label>
          <label className='flex items-center gap-2 text-sm text-slate-700'>
            <input
              type='checkbox'
              checked={draft.ackRequired}
              onChange={(e) => set('ackRequired', e.target.checked)}
            />
            Everyone must read and acknowledge this policy
          </label>
        </div>

        {save.error && <p className='mt-2 text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}

        <div className='mt-4 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {save.isPending ? 'Saving…' : existing ? 'Save changes' : 'Add policy'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CELL = {
  ok: { label: '✓', cls: 'bg-green-50 text-green-700' },
  stale: { label: 'old', cls: 'bg-amber-50 text-amber-700' },
  none: { label: '✗', cls: 'bg-red-50 text-red-600' },
} as const;

/**
 * Retire / Restore for one row. Retiring takes a second click within a few
 * seconds (the viewer has no confirm dialog to lean on, and this hides the
 * policy from everyone).
 */
const RetireButton = ({ policy }: { policy: Policy }) => {
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  const change = useMutation({
    mutationFn: () =>
      policy.retiredAt ? policiesApi.restore(policy.id) : policiesApi.retire(policy.id),
    onSuccess: () => {
      setArmed(false);
      queryClient.invalidateQueries({ queryKey: ['hr-policies'] });
      queryClient.invalidateQueries({ queryKey: ['hr-policy-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['my-policies'] });
    },
  });
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  if (policy.retiredAt) {
    return (
      <button
        type='button'
        disabled={change.isPending}
        onClick={() => change.mutate()}
        className='text-xs text-brand-600 hover:underline disabled:opacity-50'
      >
        Restore
      </button>
    );
  }
  return (
    <button
      type='button'
      disabled={change.isPending}
      onClick={() => (armed ? change.mutate() : setArmed(true))}
      title={change.error ? apiErrorMessage(change.error) : undefined}
      className={`text-xs hover:underline disabled:opacity-50 ${armed ? 'font-medium text-red-600' : 'text-slate-400'}`}
    >
      {armed ? 'Click again to retire' : 'Retire'}
    </button>
  );
};

/** Acknowledgement tracker + policy management, behind hrbp.policies. */
const HrPoliciesPage = () => {
  const [tab, setTab] = useState<'tracker' | 'manage'>('tracker');
  const [editing, setEditing] = useState<Policy | null>(null);
  const [adding, setAdding] = useState(false);

  const tracker = useQuery({
    queryKey: ['hr-policy-tracker'],
    queryFn: policiesApi.tracker,
    enabled: tab === 'tracker',
  });
  const list = useQuery({
    queryKey: ['hr-policies'],
    queryFn: policiesApi.manage,
    enabled: tab === 'manage',
  });

  const cells = tracker.data?.rows.flatMap((r) => r.cells) ?? [];
  const okCount = cells.filter((c) => c.state === 'ok').length;
  const staleCount = cells.filter((c) => c.state === 'stale').length;
  const coverage = cells.length > 0 ? Math.round((okCount / cells.length) * 100) : null;
  const fullyCovered =
    tracker.data?.rows.filter((r) => r.cells.every((c) => c.state === 'ok')).length ?? 0;

  return (
    <div className='w-full space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold text-slate-800'>Policies</h1>
        <div className='flex items-center gap-2'>
          {(['tracker', 'manage'] as const).map((t) => (
            <button
              key={t}
              type='button'
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                tab === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'tracker' ? 'Acknowledgements' : 'Manage'}
            </button>
          ))}
          <button
            type='button'
            onClick={() => setAdding(true)}
            className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500'
          >
            + Add policy
          </button>
        </div>
      </div>

      {tab === 'tracker' && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          {tracker.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
          {tracker.error && (
            <p className='text-sm text-red-600'>{apiErrorMessage(tracker.error)}</p>
          )}
          {tracker.data && tracker.data.policies.length === 0 && (
            <p className='text-sm text-slate-500'>
              No ack-required policies yet — add one under Manage.
            </p>
          )}
          {tracker.data && tracker.data.policies.length > 0 && (
            <>
              <div className='mb-4 flex flex-wrap gap-4 text-sm'>
                <span
                  className={`font-medium ${
                    (coverage ?? 0) >= 90
                      ? 'text-green-700'
                      : (coverage ?? 0) >= 60
                        ? 'text-amber-700'
                        : 'text-red-600'
                  }`}
                >
                  {coverage}% acknowledged
                </span>
                <span className='text-slate-500'>
                  {fullyCovered}/{tracker.data.rows.length} people fully covered
                </span>
                {staleCount > 0 && (
                  <span className='text-amber-700'>{staleCount} signatures on an old version</span>
                )}
              </div>
              <div className='overflow-x-auto'>
                <table className='min-w-full text-sm'>
                  <thead>
                    <tr className='text-left text-xs uppercase tracking-wide text-slate-400'>
                      <th className='sticky left-0 bg-white py-2 pr-4'>Person</th>
                      {tracker.data.policies.map((p) => (
                        <th key={p.id} className='px-2 py-2 text-center font-medium'>
                          {p.title}
                          <span className='block text-[10px] normal-case text-slate-300'>
                            v{p.version}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tracker.data.rows.map((r) => (
                      <tr key={r.employee.id} className='border-t border-slate-100'>
                        <td className='sticky left-0 bg-white py-2 pr-4'>
                          <span className='font-medium text-slate-700'>{r.employee.name}</span>
                          <span className='ml-2 text-xs text-slate-400'>
                            {r.employee.employeeCode}
                          </span>
                        </td>
                        {r.cells.map((c) => (
                          <td key={c.policyId} className='px-2 py-2 text-center'>
                            <span
                              title={
                                c.ackedVersion
                                  ? `signed v${c.ackedVersion}`
                                  : 'never acknowledged'
                              }
                              className={`inline-block min-w-8 rounded-full px-2 py-0.5 text-xs ${CELL[c.state].cls}`}
                            >
                              {CELL[c.state].label}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'manage' && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          {list.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
          {list.error && <p className='text-sm text-red-600'>{apiErrorMessage(list.error)}</p>}
          {list.data && list.data.length === 0 && (
            <p className='text-sm text-slate-500'>No policies yet.</p>
          )}
          {list.data && list.data.length > 0 && (
            <table className='min-w-full text-sm'>
              <thead>
                <tr className='text-left text-xs uppercase tracking-wide text-slate-400'>
                  <th className='py-2 pr-4'>Policy</th>
                  <th className='py-2 pr-4'>Category</th>
                  <th className='py-2 pr-4'>Version</th>
                  <th className='py-2 pr-4'>Sign-off</th>
                  <th className='py-2 pr-4'>Document</th>
                  <th className='py-2'></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-t border-slate-100 ${p.retiredAt ? 'opacity-60' : ''}`}
                  >
                    <td className='py-2 pr-4'>
                      <span className='font-medium text-slate-700'>{p.title}</span>
                      <span className='ml-2 text-xs text-slate-400'>{p.code}</span>
                      {p.retiredAt && (
                        <span
                          title={`Retired ${new Date(p.retiredAt).toLocaleDateString()} — hidden from employees and the tracker; signatures kept`}
                          className='ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500'
                        >
                          retired
                        </span>
                      )}
                    </td>
                    <td className='py-2 pr-4 capitalize text-slate-600'>{p.category}</td>
                    <td className='py-2 pr-4 text-slate-600'>v{p.version}</td>
                    <td className='py-2 pr-4 text-slate-600'>
                      {p.ackRequired ? 'required' : 'not required'}
                    </td>
                    <td className='py-2 pr-4'>
                      {p.hasDocument ? (
                        <button
                          type='button'
                          onClick={() => void policiesApi.openDocument(p.id)}
                          className='rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 hover:underline'
                        >
                          PDF in DB
                        </button>
                      ) : p.docUrl ? (
                        <span className='rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'>
                          external link
                        </span>
                      ) : (
                        <span className='text-xs text-slate-400'>none</span>
                      )}
                    </td>
                    <td className='py-2 text-right'>
                      <span className='inline-flex items-center gap-3'>
                        <button
                          type='button'
                          onClick={() => setEditing(p)}
                          className='text-xs text-brand-600 hover:underline'
                        >
                          Edit
                        </button>
                        <RetireButton policy={p} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(adding || editing) && (
        <PolicyModal existing={editing} onClose={() => { setAdding(false); setEditing(null); }} />
      )}
    </div>
  );
};

export default HrPoliciesPage;

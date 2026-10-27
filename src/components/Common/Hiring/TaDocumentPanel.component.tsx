import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { JdContent, ScorecardContent, TaDocument } from '@app-types/api.types';
import JdDocument from '@components/Common/Hiring/JdDocument.component';
import { ROUND_LABEL } from '@constants/Common/hiring.constants';
import { hiringApi } from '@services/api/hiring.api';
import { apiErrorMessage } from '@utils/apiError';

const DOC_STATUS_LABEL: Record<TaDocument['status'], string> = {
  draft: 'Draft',
  in_review: 'In review',
  returned: 'Returned — edit and resubmit',
  approved: 'Approved',
};

const DOC_STATUS_CLASS: Record<TaDocument['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  in_review: 'bg-sky-50 text-sky-700',
  returned: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
};

const REVIEWER_LABEL = { dept_head: 'Dept head', ta_rm: 'TA RM' } as const;

/** The JD at a glance; "View JD" opens it as the branded, printable page. */
const JdView = ({ c, roleTitle }: { c: Partial<JdContent>; roleTitle: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className='space-y-2 text-sm'>
      <p className='text-xs text-slate-500'>
        {[c.jobType, c.city, c.ctc].filter(Boolean).join(' · ')}
      </p>
      {c.roleSummary && <p className='line-clamp-3 text-slate-700'>{c.roleSummary}</p>}
      <p className='text-xs text-slate-500'>
        {c.responsibilities?.length ?? 0} responsibilities · {c.requiredSkills?.length ?? 0}{' '}
        required skills
      </p>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
      >
        View JD (print / PDF)
      </button>
      {open && <JdDocument c={c} roleTitle={roleTitle} onClose={() => setOpen(false)} />}
    </div>
  );
};

/** The scorecard by round: weight, attributes and their questions. */
const ScorecardView = ({ c }: { c: Partial<ScorecardContent> }) => (
  <div className='space-y-2 text-sm'>
    {(c.rounds ?? []).map((r) => (
      <details key={r.round} className='rounded-md bg-white px-2 py-1.5'>
        <summary className='cursor-pointer text-slate-700'>
          <span className='font-medium'>{ROUND_LABEL[r.round]}</span>{' '}
          <span className='text-xs text-slate-400'>
            · weight {r.weight}% · {r.attributes.length} attributes, scored 1–4
          </span>
        </summary>
        <ul className='mt-1 space-y-1 pl-2'>
          {r.attributes.map((a) => (
            <li key={a.name}>
              <p className='text-slate-700'>{a.name}</p>
              {a.questions.map((q, i) => (
                <p key={i} className='pl-3 text-xs text-slate-500'>
                  • {q}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </details>
    ))}
  </div>
);

/**
 * A JD or scorecard as everyone sees it: content, status, and where the two
 * reviews (TA RM + dept head) stand on the CURRENT version. With `canReview`
 * the reviewer approves or returns it, for the version shown.
 */
const TaDocumentPanel = ({
  doc,
  roleTitle,
  canReview = false,
  invalidate,
}: {
  doc: TaDocument;
  /** The position's role, shown as "Job Role –" on the JD. */
  roleTitle: string;
  canReview?: boolean;
  /** Query keys to refresh after a decision. */
  invalidate: string[][];
}) => {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const go = useMutation({
    mutationFn: (decision: 'approve' | 'reject') =>
      hiringApi.decideDocument(doc.id, {
        version: doc.version,
        decision,
        reason: decision === 'reject' ? reason.trim() : undefined,
      }),
    onSuccess: () => {
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: key });
      setRejecting(false);
    },
  });
  const title = doc.kind === 'jd' ? 'Job description' : 'Scorecard';

  return (
    <div className='space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-medium text-slate-800'>
          {title}{' '}
          <span className='text-xs text-slate-400'>
            v{doc.version} · by {doc.writtenByName}
          </span>
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DOC_STATUS_CLASS[doc.status]}`}
        >
          {DOC_STATUS_LABEL[doc.status]}
        </span>
      </div>
      {doc.kind === 'jd' ? (
        <JdView c={doc.content as Partial<JdContent>} roleTitle={roleTitle} />
      ) : (
        <ScorecardView c={doc.content as Partial<ScorecardContent>} />
      )}
      {doc.status === 'returned' && doc.returnReason && (
        <p className='rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800'>
          Returned: {doc.returnReason}
        </p>
      )}
      {(doc.status === 'in_review' || doc.approvals.length > 0) && (
        <div className='flex flex-wrap gap-2 text-xs'>
          {doc.approvals.map((a) => (
            <span
              key={a.role}
              title={a.reason ?? undefined}
              className={a.decision === 'approve' ? 'text-emerald-700' : 'text-red-600'}
            >
              {a.decision === 'approve' ? '✓' : '✕'} {REVIEWER_LABEL[a.role]} ({a.decidedByName})
            </span>
          ))}
          {doc.waitingOn.map((r) => (
            <span key={r} className='text-slate-400'>
              … {REVIEWER_LABEL[r]}
            </span>
          ))}
        </div>
      )}
      {canReview && doc.status === 'in_review' && (
        <div className='space-y-2'>
          {rejecting && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder='What should the recruiter change?'
              className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
            />
          )}
          {go.error && <p className='text-sm text-red-600'>{apiErrorMessage(go.error)}</p>}
          <div className='flex justify-end gap-2'>
            <button
              type='button'
              onClick={() => setRejecting(!rejecting)}
              className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
            >
              {rejecting ? 'Back' : 'Reject'}
            </button>
            {rejecting ? (
              <button
                type='button'
                disabled={!reason.trim() || go.isPending}
                onClick={() => go.mutate('reject')}
                className='rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50'
              >
                Return to recruiter
              </button>
            ) : (
              <button
                type='button'
                disabled={go.isPending}
                onClick={() => go.mutate('approve')}
                className='rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50'
              >
                Approve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaDocumentPanel;

import type { ReactNode } from 'react';

import type { Requisition } from '@app-types/api.types';
import {
  APPROVER_LABEL,
  POSITION_STATUS_LABEL,
  REQ_STATUS_CLASS,
  REQ_STATUS_LABEL,
  budgetText,
  ROUND_LABEL,
} from '@constants/Common/hiring.constants';

/**
 * One hiring line as every hiring screen shows it: role, status, rounds with
 * interviewers, and where the approvals stand on the CURRENT version.
 */
const RequisitionCard = ({
  req,
  showDepartment = false,
  actions,
}: {
  req: Requisition;
  showDepartment?: boolean;
  actions?: ReactNode;
}) => (
  <div className='space-y-2 rounded-xl border border-slate-200 bg-white p-4'>
    <div className='flex flex-wrap items-start justify-between gap-2'>
      <div>
        <p className='font-medium text-slate-800'>
          {req.quantity} × {req.roleTitle}
          {req.urgent && (
            <span className='ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700'>
              urgent
            </span>
          )}
        </p>
        <p className='text-xs text-slate-400'>
          {[
            showDepartment && req.departmentName,
            req.quarter,
            budgetText(req.budgetMin, req.budgetMax) &&
              `budget ${budgetText(req.budgetMin, req.budgetMax)} per hire`,
            `v${req.version}`,
            `by ${req.createdByName}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REQ_STATUS_CLASS[req.status]}`}
      >
        {REQ_STATUS_LABEL[req.status]}
      </span>
    </div>
    {req.notes && <p className='whitespace-pre-wrap text-sm text-slate-600'>{req.notes}</p>}
    <div className='flex flex-wrap gap-1.5'>
      {req.rounds.map((r) => (
        <span key={r.round} className='rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600'>
          {ROUND_LABEL[r.round]}
          {r.interviewerName ? ` — ${r.interviewerName}` : ' — to be named'}
        </span>
      ))}
    </div>
    {req.returnReason && req.status === 'returned' && (
      <p className='rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800'>
        Returned: {req.returnReason}
      </p>
    )}
    {(req.status === 'submitted' || req.approvals.length > 0) && (
      <div className='flex flex-wrap gap-2 text-xs'>
        {req.approvals.map((a) => (
          <span
            key={a.role}
            title={a.reason ?? undefined}
            className={a.decision === 'approve' ? 'text-emerald-700' : 'text-red-600'}
          >
            {a.decision === 'approve' ? '✓' : '✕'} {APPROVER_LABEL[a.role]} ({a.decidedByName})
          </span>
        ))}
        {req.waitingOn.length > 0 && (
          // One approval from any of them is enough.
          <span className='text-slate-400'>
            … waiting for {req.waitingOn.map((role) => APPROVER_LABEL[role]).join(' or ')}
          </span>
        )}
      </div>
    )}
    {req.positions.length > 0 && (
      <div className='flex flex-wrap gap-1.5 text-xs'>
        {req.positions.map((p) => (
          <span
            key={p.id}
            className={`rounded px-2 py-0.5 ${
              p.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
            }`}
          >
            #{p.number} · {POSITION_STATUS_LABEL[p.status]}
            {p.recruiterName ? ` · ${p.recruiterName}` : ' · unassigned'}
          </span>
        ))}
      </div>
    )}
    {actions && <div className='flex flex-wrap justify-end gap-2 pt-1'>{actions}</div>}
  </div>
);

export default RequisitionCard;

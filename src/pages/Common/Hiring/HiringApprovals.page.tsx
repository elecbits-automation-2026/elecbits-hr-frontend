import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Requisition, TaRmOption } from '@app-types/api.types';
import RequisitionCard from '@components/Common/Hiring/RequisitionCard.component';
import OfferApprovalCard from '@components/Common/Hiring/OfferApprovalCard.component';
import TaDocumentPanel from '@components/Common/Hiring/TaDocumentPanel.component';
import { hireApi } from '@services/api/hire.api';
import { APPROVER_LABEL } from '@constants/Common/hiring.constants';
import { hiringApi } from '@services/api/hiring.api';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';

const Decide = ({ req }: { req: Requisition }) => {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const go = useMutation({
    mutationFn: (decision: 'approve' | 'reject' | 'decline') =>
      hiringApi.decide(req.id, {
        version: req.version,
        decision,
        reason: decision === 'approve' ? undefined : reason.trim(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hiring-approvals'] }),
  });
  return (
    <div className='w-full space-y-2'>
      {rejecting && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder='Why? The head sees this and edits the line.'
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
        />
      )}
      {go.error && <p className='text-sm text-red-600'>{apiErrorMessage(go.error)}</p>}
      <div className='flex justify-end gap-2'>
        {rejecting ? (
          <>
            <button
              type='button'
              onClick={() => setRejecting(false)}
              className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
            >
              Back
            </button>
            <button
              type='button'
              disabled={!reason.trim() || go.isPending}
              onClick={() => go.mutate('reject')}
              className='rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50'
            >
              Return to fix
            </button>
            <button
              type='button'
              disabled={!reason.trim() || go.isPending}
              onClick={() => go.mutate('decline')}
              className='rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50'
            >
              Reject for good
            </button>
          </>
        ) : (
          <>
            <button
              type='button'
              onClick={() => setRejecting(true)}
              className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
            >
              Reject
            </button>
            <button
              type='button'
              disabled={go.isPending}
              onClick={() => go.mutate('approve')}
              className='rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50'
            >
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/** Admin: give a line to a TA RM (or change who, until their team holds a position). */
const GiveToTaRm = ({ req, options }: { req: Requisition; options: TaRmOption[] }) => {
  const queryClient = useQueryClient();
  const [taRmId, setTaRmId] = useState('');
  const go = useMutation({
    mutationFn: () => hiringApi.assignTaRm(req.id, taRmId),
    onSuccess: () => {
      setTaRmId('');
      queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
    },
  });
  return (
    <div className='w-full space-y-2'>
      <p className='text-sm text-slate-600'>
        {req.taRm ? (
          <>
            TA RM: <span className='font-medium text-slate-800'>{req.taRm.name}</span> — you can
            change this until their team takes a position.
          </>
        ) : (
          'Approved — give it to a TA RM, who assigns the positions to their team.'
        )}
      </p>
      {go.error && <p className='text-sm text-red-600'>{apiErrorMessage(go.error)}</p>}
      <div className='flex justify-end gap-2'>
        <select
          value={taRmId}
          onChange={(e) => setTaRmId(e.target.value)}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none'
        >
          <option value=''>TA RM…</option>
          {options
            .filter((o) => o.id !== req.taRm?.id)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.reports} report{o.reports === 1 ? '' : 's'}
              </option>
            ))}
        </select>
        <button
          type='button'
          disabled={!taRmId || go.isPending}
          onClick={() => go.mutate()}
          className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50'
        >
          {req.taRm ? 'Change' : 'Give'}
        </button>
      </div>
    </div>
  );
};

/**
 * Hiring lines waiting for MY decision — the HR department's head or the
 * Admin account (mounted in the Admin console too). One decision covers every
 * approver role the person holds; it applies to the version shown only. Admin
 * also gives approved lines to a TA RM here.
 */
const HiringApprovalsPage = () => {
  const me = useQuery({ queryKey: ['hiring-me'], queryFn: hiringApi.me });
  const waiting = useQuery({ queryKey: ['hiring-approvals'], queryFn: hiringApi.approvals });
  // Positions' JDs and scorecards — the line's TA RM reviews them here (dept heads on their plan).
  const reviews = useQuery({ queryKey: ['hiring-reviews'], queryFn: hiringApi.reviews });
  // Offers the HR Head approves and signs (workflow deck step 15).
  const decisions = useQuery({ queryKey: ['pending-offers'], queryFn: hireApi.pendingOffers });
  const owner = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isAdmin = !!owner.data?.isOwner;
  // Lines Admin still has to give (or may still move): approved,
  // and nobody on the TA RM's team holds one of its positions yet.
  const lines = useQuery({
    queryKey: ['hiring-requisitions', 'for-ta-rm'],
    queryFn: () => hiringApi.list(),
    enabled: isAdmin,
  });
  const taRms = useQuery({ queryKey: ['hiring-ta-rms'], queryFn: hiringApi.taRms, enabled: isAdmin });
  const toGive = (lines.data ?? []).filter(
    (r) =>
      r.status === 'approved' &&
      r.positions.every((p) => !p.recruiterId) &&
      r.positions.some((p) => p.status !== 'filled' && p.status !== 'cancelled'),
  );

  if (waiting.isLoading || me.isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (waiting.error)
    return <p className='text-sm text-red-600'>{apiErrorMessage(waiting.error)}</p>;
  const roles = me.data?.approverRoles ?? [];

  return (
    <div className='w-full space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Hiring approvals</h1>
        <p className='text-sm text-slate-500'>
          {roles.length
            ? `You review hiring requests as ${roles.map((r) => APPROVER_LABEL[r]).join(' + ')}. One HRBP's decision is enough: approve, return it to fix, or reject it for good — the department head and the other HRBPs are told. Your own requests go to the other HRBPs.`
            : 'JDs, scorecards and offers waiting for you.'}
        </p>
      </div>
      {(decisions.data?.length ?? 0) > 0 && (
        <div className='space-y-3'>
          <h2 className='text-lg font-semibold text-slate-800'>Offers to approve and sign</h2>
          {decisions.data!.map((a) => (
            <OfferApprovalCard key={a.id} app={a} />
          ))}
        </div>
      )}
      {toGive.length > 0 && (
        <div className='space-y-3'>
          <h2 className='text-lg font-semibold text-slate-800'>Give to a TA RM</h2>
          {taRms.data?.length === 0 && (
            <p className='text-sm text-amber-700'>
              Nobody qualifies yet: a TA RM holds the TA batch and has someone reporting to them.
            </p>
          )}
          {toGive.map((r) => (
            <RequisitionCard
              key={r.id}
              req={r}
              showDepartment
              actions={<GiveToTaRm req={r} options={taRms.data ?? []} />}
            />
          ))}
        </div>
      )}
      {waiting.data?.length === 0 &&
        !reviews.data?.length &&
        !decisions.data?.length &&
        toGive.length === 0 && (
        <p className='rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>
          Nothing waiting for you.
        </p>
      )}
      <div className='space-y-3'>
        {waiting.data?.map((r) => (
          <RequisitionCard key={r.id} req={r} showDepartment actions={<Decide req={r} />} />
        ))}
      </div>

      {(reviews.data?.length ?? 0) > 0 && (
        <div className='space-y-3'>
          <h2 className='text-lg font-semibold text-slate-800'>JDs and scorecards to review</h2>
          {reviews.data!.map((v) => (
            <div key={v.document.id} className='space-y-1'>
              <p className='text-xs text-slate-500'>
                {v.roleTitle} #{v.positionNumber} · {v.departmentName}
                {v.recruiterName && <> · written by {v.recruiterName}</>}
              </p>
              <TaDocumentPanel
                doc={v.document}
                roleTitle={v.roleTitle}
                canReview
                invalidate={[['hiring-reviews']]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HiringApprovalsPage;

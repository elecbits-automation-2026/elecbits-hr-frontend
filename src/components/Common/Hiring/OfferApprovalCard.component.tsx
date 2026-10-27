import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Application } from '@app-types/api.types';
import ScorecardSummary from '@components/Common/Hiring/ScorecardSummary.component';
import { rupees } from '@constants/Common/hiring.constants';
import { hireApi } from '@services/api/hire.api';
import { apiErrorMessage } from '@utils/apiError';

const btn =
  'rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50';

/**
 * An offer waiting for the HR Head (workflow deck step 15): the terms, the
 * draft letter and the candidate's scorecard summary. The HR Head uploads the
 * signed letter and approves — or returns it with what to change.
 */
const OfferApprovalCard = ({ app }: { app: Application }) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-offers'] });
    queryClient.invalidateQueries({ queryKey: ['hiring-requisitions'] });
  };
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const upload = useMutation({
    mutationFn: (file: File) => hireApi.uploadSignedLetter(app.id, file),
    onSuccess: refresh,
  });
  const approve = useMutation({ mutationFn: () => hireApi.approveOffer(app.id), onSuccess: refresh });
  const back = useMutation({
    mutationFn: () => hireApi.returnOffer(app.id, reason.trim()),
    onSuccess: refresh,
  });
  const o = app.offer;

  return (
    <div className='space-y-3 rounded-xl border border-slate-200 bg-white p-4'>
      <div>
        <p className='font-medium text-slate-800'>
          {app.candidateName}{' '}
          <span className='font-mono text-xs font-normal text-slate-400'>{app.candidateCode}</span>
        </p>
        <p className='text-xs text-slate-400'>
          {app.roleTitle} #{app.positionNumber} · {app.departmentName}
        </p>
      </div>
      {o && (
        <div className='rounded-lg bg-slate-50 p-3 text-sm text-slate-700'>
          <p>
            <span className='font-semibold'>{o.ctc !== null && rupees(o.ctc)}</span> per year ·
            joining {o.joiningDate}
          </p>
          {o.terms && <p className='mt-1 text-xs text-slate-600'>{o.terms}</p>}
          <p className='mt-1 text-xs text-slate-500'>
            Documents: {app.documents.received} received · {app.documents.pending} pending
          </p>
        </div>
      )}
      <ScorecardSummary app={app} />
      <div className='flex flex-wrap items-center gap-2'>
        {app.hasOfferLetter && (
          <button type='button' onClick={() => hireApi.openOfferLetter(app.id)} className={btn}>
            Open the draft letter
          </button>
        )}
        <label className={`${btn} cursor-pointer`}>
          {app.hasSignedLetter ? 'Replace the signed letter' : 'Upload the signed letter'}
          <input
            type='file'
            accept='.pdf,.doc,.docx'
            className='hidden'
            onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
          />
        </label>
        {app.hasSignedLetter && (
          <span className='text-xs text-emerald-700'>✓ Signed letter uploaded</span>
        )}
      </div>
      {returning && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder='What should TA change?'
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
        />
      )}
      {(upload.error || approve.error || back.error) && (
        <p className='text-sm text-red-600'>
          {apiErrorMessage(upload.error ?? approve.error ?? back.error)}
        </p>
      )}
      <div className='flex justify-end gap-2'>
        {returning ? (
          <>
            <button type='button' onClick={() => setReturning(false)} className={btn}>
              Back
            </button>
            <button
              type='button'
              disabled={!reason.trim() || back.isPending}
              onClick={() => back.mutate()}
              className='rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50'
            >
              Return to TA
            </button>
          </>
        ) : (
          <>
            <button type='button' onClick={() => setReturning(true)} className={btn}>
              Return
            </button>
            <button
              type='button'
              disabled={!app.hasSignedLetter || approve.isPending}
              title={app.hasSignedLetter ? undefined : 'Upload the signed letter first'}
              onClick={() => approve.mutate()}
              className='rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50'
            >
              Approve the signed offer
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OfferApprovalCard;

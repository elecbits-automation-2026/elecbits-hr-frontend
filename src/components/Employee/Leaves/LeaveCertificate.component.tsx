import { useRef, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { LeaveRequest } from '@app-types/api.types';
import { leavesApi } from '@services/api/leaves.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * Sick-leave certificate (exit module): during notice, 3+ sick days in a row
 * need one, or they're unpaid in the full & final. Shows on any sick leave so
 * a certificate can always be attached; flagged when it's required.
 */
const LeaveCertificate = ({ leave }: { leave: LeaveRequest }) => {
  const queryClient = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (f: File) => leavesApi.uploadCertificate(leave.id, f),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-leaves'] }),
  });
  const open = useMutation({ mutationFn: () => leavesApi.openCertificate(leave.id) });
  if (leave.type !== 'sick' || leave.status === 'declined' || leave.status === 'cancelled') {
    return null;
  }
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload.mutate(f);
    e.target.value = '';
  };
  return (
    <div className='mt-1 text-xs'>
      <input
        ref={file}
        type='file'
        accept='application/pdf,image/jpeg,image/png'
        onChange={pick}
        className='hidden'
      />
      {leave.certificate ? (
        <span className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            onClick={() => open.mutate()}
            className='text-brand-700 hover:underline'
          >
            Certificate: {leave.certificate.fileName}
          </button>
          <button
            type='button'
            onClick={() => file.current?.click()}
            className='text-slate-400 hover:text-slate-700'
          >
            Replace
          </button>
        </span>
      ) : (
        <span className='flex flex-wrap items-center gap-2'>
          {leave.certificateNeeded && (
            <span className='rounded-full bg-amber-50 px-2 py-0.5 text-amber-800'>
              Certificate needed — otherwise unpaid in your F&F
            </span>
          )}
          <button
            type='button'
            disabled={upload.isPending}
            onClick={() => file.current?.click()}
            className='text-brand-700 hover:underline disabled:opacity-50'
          >
            {upload.isPending ? 'Uploading…' : 'Upload medical certificate'}
          </button>
        </span>
      )}
      {(upload.error || open.error) && (
        <p className='text-red-600'>{apiErrorMessage(upload.error ?? open.error)}</p>
      )}
    </div>
  );
};

export default LeaveCertificate;

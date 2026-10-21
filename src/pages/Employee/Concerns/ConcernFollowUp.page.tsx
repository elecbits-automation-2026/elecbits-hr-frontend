import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import type { Concern } from '@app-types/api.types';
import ConcernCase from '@components/Employee/Concerns/ConcernCase.component';
import { CONCERNS_ROUTE } from '@constants/Common/navigation/routes.constants';
import { concernsApi } from '@services/api/concerns.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

/**
 * Follow up an anonymous report with its case code and the key shown once at
 * filing: read the status and replies, add information. Nothing here links the
 * report to whoever is signed in.
 */
const ConcernFollowUpPage = () => {
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [concern, setConcern] = useState<Concern | null>(null);

  const open = useMutation({
    mutationFn: () => concernsApi.followUp({ code: code.trim(), key: key.trim() }),
    onSuccess: setConcern,
  });

  return (
    <div className='w-full max-w-3xl space-y-4'>
      <div>
        <Link to={CONCERNS_ROUTE} className='text-sm text-brand-700 hover:underline'>
          ← Concerns
        </Link>
        <h1 className='mt-1 text-2xl font-semibold text-slate-800'>
          Follow up an anonymous report
        </h1>
      </div>

      {!concern && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            open.mutate();
          }}
          className='space-y-3 rounded-xl border border-slate-200 bg-white p-5'
        >
          <label className='block text-xs text-slate-500'>
            Case code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder='CMP-2026-001'
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className='block text-xs text-slate-500'>
            Key
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete='off'
              className={`${inputClass} mt-1 font-mono`}
            />
          </label>
          {open.error && <p className='text-sm text-red-600'>{apiErrorMessage(open.error)}</p>}
          <div className='flex justify-end'>
            <button
              type='submit'
              disabled={code.trim().length < 5 || key.trim().length < 10 || open.isPending}
              className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40'
            >
              {open.isPending ? 'Opening…' : 'Open'}
            </button>
          </div>
        </form>
      )}

      {concern && (
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <div className='mb-3 flex justify-end'>
            <button
              type='button'
              onClick={() => {
                setConcern(null);
                setKey('');
              }}
              className='text-sm text-slate-500 hover:text-slate-800'
            >
              Close
            </button>
          </div>
          <ConcernCase
            concern={concern}
            mode='followup'
            onChanged={setConcern}
            onFollowUpNote={(body) =>
              concernsApi.followUpNote({ code: code.trim(), key: key.trim(), body })
            }
          />
        </div>
      )}
    </div>
  );
};

export default ConcernFollowUpPage;

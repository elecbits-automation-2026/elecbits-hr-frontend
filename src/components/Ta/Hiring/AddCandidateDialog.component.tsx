import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { Candidate, CandidateMatch, CandidateSource } from '@app-types/api.types';
import { SOURCE_LABEL } from '@constants/Common/hiring.constants';
import { candidatesApi } from '@services/api/candidates.api';
import { concernsApi } from '@services/api/concerns.api';
import { apiErrorMessage } from '@utils/apiError';

const input =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

/**
 * Add a candidate to the talent pool (TA Step D): one by one, consent
 * required, CV optional. Before saving it checks email / phone against the
 * pool — a match is REUSED (onDone gets the existing person) instead of
 * creating a duplicate.
 */
const AddCandidateDialog = ({
  onDone,
  onClose,
}: {
  onDone: (candidateId: string) => void;
  onClose: () => void;
}) => {
  const directory = useQuery({
    queryKey: ['concern-people'],
    queryFn: concernsApi.people,
    staleTime: 5 * 60_000,
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<CandidateSource>('naukri');
  const [referredById, setReferredById] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [cv, setCv] = useState<File | null>(null);
  const [matches, setMatches] = useState<CandidateMatch[]>([]);

  const check = async () => {
    if (!email.trim() && !phone.trim()) return setMatches([]);
    setMatches(await candidatesApi.matches(email.trim() || undefined, phone.trim() || undefined));
  };

  const save = useMutation({
    mutationFn: async (): Promise<Candidate> => {
      const c = await candidatesApi.create({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        source,
        referredById: source === 'referral' ? referredById : undefined,
        notes: notes.trim() || undefined,
        consent: true,
      });
      return cv ? candidatesApi.uploadCv(c.id, cv) : c;
    },
    onSuccess: (c) => onDone(c.id),
  });

  const valid =
    name.trim() &&
    (email.trim() || phone.trim()) &&
    consent &&
    (source !== 'referral' || referredById) &&
    matches.length === 0;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
        <h2 className='text-lg font-semibold text-slate-800'>Add a candidate</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Full name'
          className={input}
        />
        <div className='grid grid-cols-2 gap-2'>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={check}
            placeholder='Email'
            className={input}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={check}
            placeholder='Phone'
            className={input}
          />
        </div>
        {matches.length > 0 && (
          <div className='space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800'>
            <p>Already in the talent pool — reuse them instead of adding a duplicate:</p>
            {matches.map((m) => (
              <div key={m.id} className='flex items-center justify-between gap-2'>
                <span>
                  {m.name}{' '}
                  <span className='text-xs'>{[m.email, m.phone].filter(Boolean).join(' · ')}</span>
                </span>
                <button
                  type='button'
                  onClick={() => onDone(m.id)}
                  className='rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700'
                >
                  Use this person
                </button>
              </div>
            ))}
          </div>
        )}
        <div className='grid grid-cols-2 gap-2'>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as CandidateSource)}
            className={input}
          >
            {(Object.keys(SOURCE_LABEL) as CandidateSource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
          {source === 'referral' && (
            <select
              value={referredById}
              onChange={(e) => setReferredById(e.target.value)}
              className={input}
            >
              <option value=''>Referred by…</option>
              {directory.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder='Notes (experience, notice period, expected CTC…)'
          className={input}
        />
        <label className='block space-y-1'>
          <span className='text-xs text-slate-500'>CV (PDF or Word, up to 10 MB)</span>
          <input
            type='file'
            accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            onChange={(e) => setCv(e.target.files?.[0] ?? null)}
            className='block text-sm'
          />
        </label>
        <label className='flex items-start gap-2 text-sm text-slate-700'>
          <input
            type='checkbox'
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className='mt-0.5'
          />
          The candidate agreed to be kept in our talent pool for 6 months.
        </label>
        {save.error && <p className='text-sm text-red-600'>{apiErrorMessage(save.error)}</p>}
        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
            className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50'
          >
            {save.isPending ? 'Saving…' : 'Add candidate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCandidateDialog;

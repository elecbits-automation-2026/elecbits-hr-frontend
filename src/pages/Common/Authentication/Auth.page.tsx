import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { HOME_ROUTE } from '@constants/Common/navigation/routes.constants';
import { authService } from '@services/auth.service';
import { apiErrorMessage } from '@utils/apiError';

/**
 * Sign in / claim screen (design doc §5.4). One form, two modes:
 *  - "Sign in": the account already exists.
 *  - "Claim my record": first sign-in — connects to the record HRBP created
 *    (no self-registration; company email only). Claiming requires the
 *    single-use invite token from the link HR shared (?claim=…); knowing a
 *    colleague's email is never enough.
 */
const AuthPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const linkToken = params.get('claim') ?? '';
  // Arriving via an invite link lands straight in claim mode, token prefilled.
  const [mode, setMode] = useState<'login' | 'claim'>(linkToken ? 'claim' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(linkToken);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await authService.login(email, password);
      else await authService.claimRecord(email, password, token.trim());
      navigate(HOME_ROUTE, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-100'>
      <form
        onSubmit={submit}
        className='w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-sm'
      >
        <div>
          <h1 className='text-xl font-bold text-brand-600'>Elecbits HR</h1>
          <p className='text-sm text-slate-500'>
            {mode === 'login' ? 'Sign in with your company email' : 'Claim your employee record'}
          </p>
        </div>

        <input
          type='email'
          required
          placeholder='you@elecbits.in'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
        />
        <input
          type='password'
          required
          minLength={8}
          placeholder={mode === 'login' ? 'Password' : 'Choose a password (min 8 chars)'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
        />
        {mode === 'claim' && (
          <div>
            <input
              type='text'
              required
              minLength={16}
              placeholder='Invite token (from the link HR shared)'
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
            />
            <p className='mt-1 text-xs text-slate-400'>
              Filled automatically when you open the invite link. Expired? Ask HR for a new one.
            </p>
          </div>
        )}

        {error && <p className='text-sm text-red-600'>{error}</p>}

        <button
          type='submit'
          disabled={busy}
          className='w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Claim record'}
        </button>

        <button
          type='button'
          onClick={() => setMode(mode === 'login' ? 'claim' : 'login')}
          className='w-full text-center text-xs text-slate-500 hover:text-brand-600'
        >
          {mode === 'login' ? 'First time here? Claim your record' : 'Already claimed? Sign in'}
        </button>
      </form>
    </div>
  );
};

export default AuthPage;

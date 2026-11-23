import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import ThemeToggle from '@components/Common/Navigation/ThemeToggle.component';
import { HOME_ROUTE } from '@constants/Common/navigation/routes.constants';
import { authService } from '@services/auth.service';
import { apiErrorMessage } from '@utils/apiError';

/** What a Google sign-in bounce-back (?error=CODE) means, in plain words. */
const GOOGLE_ERRORS: Record<string, string> = {
  NOT_COMPANY_ACCOUNT: 'Use your @elecbits.in Google account.',
  NO_HR_ACCOUNT:
    "No active HR account for this Google address. If you're new, claim your record from HR's invite link first.",
  EMAIL_UNVERIFIED: 'Your Google email is not verified.',
  OAUTH_STATE_INVALID: 'That sign-in attempt expired — please try again.',
  OAUTH_VERIFY_FAILED: "Google sign-in couldn't be completed — try again or use your password.",
  SSO_DISABLED: "Google sign-in isn't available right now — use your password.",
  access_denied: 'Google sign-in was cancelled.',
};

/** Google's "G" mark, inline so the button needs no image or library. */
const GoogleMark = () => (
  <svg viewBox='0 0 48 48' className='h-4 w-4' aria-hidden='true'>
    <path
      fill='#FFC107'
      d='M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z'
    />
    <path
      fill='#FF3D00'
      d='M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z'
    />
    <path
      fill='#4CAF50'
      d='M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z'
    />
    <path
      fill='#1976D2'
      d='M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z'
    />
  </svg>
);

/**
 * Sign in / claim screen (design doc §5.4). One form, two modes:
 *  - "Sign in": the account already exists — with Google (SSO), or the
 *    password form as the fallback.
 *  - "Claim my record": first sign-in — connects to the record HRBP created
 *    (no self-registration; company email only). Claiming requires the
 *    single-use invite token from the link HR shared (?claim=…); knowing a
 *    colleague's email is never enough.
 *
 * Google sign-in leaves for the backend and comes back here: ?google=done
 * (the refresh cookie is set — pick up the session) or ?error=CODE.
 */
const AuthPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const linkToken = params.get('claim') ?? '';
  // Arriving via an invite link lands straight in claim mode, token prefilled.
  const [mode, setMode] = useState<'login' | 'claim'>(linkToken ? 'claim' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(linkToken);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const googleReturn = params.get('google') === 'done';
  const googleError = params.get('error');
  // StrictMode runs effects twice; the refresh token is single-use.
  const finishing = useRef(false);

  useEffect(() => {
    if (googleError) {
      setError(
        GOOGLE_ERRORS[googleError] ?? 'Google sign-in failed — try again or use your password.',
      );
      setParams({}, { replace: true });
      return;
    }
    if (!googleReturn || finishing.current) return;
    finishing.current = true;
    authService
      .completeGoogle()
      .then(() => navigate(HOME_ROUTE, { replace: true }))
      .catch((err) => {
        setError(apiErrorMessage(err));
        setParams({}, { replace: true });
      });
  }, [googleError, googleReturn, navigate, setParams]);

  if (googleReturn && !error) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-100'>
        <p className='text-sm text-slate-500'>Signing you in…</p>
      </div>
    );
  }

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
        <div className='flex items-center gap-3'>
          {/* The app icon (public/icons) — the same mark as the browser tab. */}
          <img src='/icons/icon-192.png' alt='' className='h-10 w-10 shrink-0 rounded-lg' />
          <div>
            <h1 className='text-xl font-bold text-brand-600'>Elecbits HR</h1>
            <p className='text-sm text-slate-500'>
              {mode === 'login' ? 'Sign in with your company email' : 'Claim your employee record'}
            </p>
          </div>
        </div>

        {mode === 'login' && (
          <>
            <a
              href={authService.googleStartUrl()}
              className='flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
            >
              <GoogleMark />
              Sign in with Google
            </a>
            <div className='flex items-center gap-3 text-xs text-slate-500'>
              <span className='h-px flex-1 bg-slate-200' />
              or use your password
              <span className='h-px flex-1 bg-slate-200' />
            </div>
          </>
        )}

        <input
          aria-label='Company email'
          type='email'
          required
          placeholder='you@elecbits.in'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
        />
        <input
          aria-label='Password'
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
              aria-label='Invite token (from the link HR shared)'
              type='text'
              required
              minLength={16}
              placeholder='Invite token (from the link HR shared)'
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
            />
            <p className='mt-1 text-xs text-slate-500'>
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

        <div className='border-t border-slate-200 pt-4 [&>div]:mx-0'>
          <ThemeToggle />
        </div>
      </form>
    </div>
  );
};

export default AuthPage;

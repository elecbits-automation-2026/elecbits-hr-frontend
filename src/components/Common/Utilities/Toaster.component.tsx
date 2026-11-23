import { useSyncExternalStore } from 'react';

import { cn } from '@utils/cn';
import { dismissToast, readToasts, subscribeToasts, type ToastKind } from '@utils/toast';

const STYLE: Record<ToastKind, { box: string; icon: string; mark: string }> = {
  success: { box: 'border-green-200', icon: 'bg-green-50 text-green-700', mark: '✓' },
  error: { box: 'border-red-200', icon: 'bg-red-50 text-red-700', mark: '!' },
  info: { box: 'border-slate-200', icon: 'bg-brand-50 text-brand-600', mark: 'i' },
};

/**
 * The toast stack, bottom-right (bottom-centre on phones). Mounted once in
 * AppProviders; raise toasts with `toast.success/error/info` from
 * @utils/toast. Colours come from the theme tokens, so dark mode just works.
 */
const Toaster = () => {
  const items = useSyncExternalStore(subscribeToasts, readToasts, readToasts);
  if (items.length === 0) return null;
  return (
    <div className='pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end'>
      {items.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-700 shadow-lg',
              s.box,
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                s.icon,
              )}
            >
              {s.mark}
            </span>
            <p className='min-w-0 flex-1 break-words'>{t.message}</p>
            <button
              type='button'
              aria-label='Dismiss'
              onClick={() => dismissToast(t.id)}
              className='shrink-0 text-slate-500 hover:text-slate-600'
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toaster;

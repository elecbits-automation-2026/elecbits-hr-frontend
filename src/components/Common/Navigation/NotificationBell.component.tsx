import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AppNotification } from '@app-types/api.types';
import { notificationsApi } from '@services/api/notifications.api';
import { apiErrorMessage } from '@utils/apiError';
import { cn } from '@utils/cn';

/** "just now" / "5m" / "3h" / "2d", then the date. */
const ago = (iso: string): string => {
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}h`;
  if (min < 7 * 24 * 60) return `${Math.floor(min / (24 * 60))}d`;
  return new Date(iso).toLocaleDateString();
};

const BellIcon = () => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={1.8}
    className='h-5 w-5'
    aria-hidden
  >
    <path
      d='M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
);

/**
 * The bell (refinement plan X2): unread badge polled every minute (and on
 * window focus); the panel loads the latest 20 when opened. Clicking a
 * notification marks it read and follows its link. Everything is the
 * caller's own — the API has no way to reach anyone else's.
 */
const NotificationBell = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(20),
    enabled: open,
  });

  const refresh = (unread: number) => {
    queryClient.setQueryData(['notifications', 'count'], unread);
    queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
  };
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const unread = count.data ?? 0;

  return (
    <div ref={rootRef} className='relative'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className='relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      >
        <BellIcon />
        {unread > 0 && (
          <span className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white'>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className='absolute left-full top-0 z-50 ml-3 w-80 rounded-xl border border-slate-200 bg-white shadow-lg'>
          <div className='flex items-center justify-between border-b border-slate-100 px-4 py-3'>
            <span className='text-sm font-semibold text-slate-800'>Notifications</span>
            <button
              type='button'
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className='text-xs text-brand-600 hover:underline disabled:text-slate-300 disabled:no-underline'
            >
              Mark all read
            </button>
          </div>
          <div className='max-h-96 overflow-y-auto'>
            {list.error && (
              <p className='px-4 py-3 text-sm text-red-600'>{apiErrorMessage(list.error)}</p>
            )}
            {list.isLoading && <p className='px-4 py-3 text-sm text-slate-400'>Loading…</p>}
            {list.data?.items.length === 0 && (
              <p className='px-4 py-6 text-center text-sm text-slate-400'>
                You&rsquo;re all caught up.
              </p>
            )}
            {list.data?.items.map((n) => (
              <button
                key={n.id}
                type='button'
                onClick={() => openItem(n)}
                className={cn(
                  'flex w-full gap-2 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50',
                  !n.readAt && 'bg-brand-50/40',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    n.readAt ? 'bg-transparent' : 'bg-brand-600',
                  )}
                />
                <span className='min-w-0 flex-1'>
                  <span className='flex items-baseline justify-between gap-2'>
                    <span
                      className={cn(
                        'text-sm',
                        n.readAt ? 'text-slate-600' : 'font-medium text-slate-800',
                      )}
                    >
                      {n.title}
                    </span>
                    <span className='shrink-0 text-[11px] text-slate-400'>{ago(n.createdAt)}</span>
                  </span>
                  {n.body && <span className='mt-0.5 block text-xs text-slate-500'>{n.body}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { APP_SECTION } from '@constants/Common/auth/portal.constants';
import {
  ADMIN_NAV,
  EMPLOYEE_NAV,
  HR_NAV,
  RM_ONLY_ROUTES,
  type NavItem,
} from '@constants/Common/navigation/nav.constants';
import {
  ADMIN_ROUTE,
  AUTH_ROUTE,
  HR_ROUTE,
} from '@constants/Common/navigation/routes.constants';
import { meApi } from '@services/api/me.api';
import { authService } from '@services/auth.service';
import { canEnterSection, holdsPortal } from '@utils/sections';
import { cn } from '@utils/cn';

import NotificationBell from './NotificationBell.component';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
    isActive && 'bg-brand-50 text-brand-600',
  );

const NavLinks = ({ items }: { items: NavItem[] }) => (
  <>
    {items.map((item) => (
      <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
        {item.label}
      </NavLink>
    ))}
  </>
);

/** A collapsible sidebar branch (HR ▾ / Admin ▾), open by default when active. */
const NavGroup = ({
  label,
  basePath,
  items,
}: {
  label: string;
  basePath: string;
  items: NavItem[];
}) => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(pathname.startsWith(basePath));

  return (
    <div className='pt-2'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-100'
      >
        {label}
        <span className='text-[10px]'>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className='mt-1 space-y-1 border-l border-slate-200 pl-2'>
          <NavLinks items={items} />
        </div>
      )}
    </div>
  );
};

/**
 * ONE sidebar for the whole app (design doc §1): Employee items for everyone,
 * then nested HR ▾ / Admin ▾ branches for those who can enter them. Visibility
 * comes from utils/sections.ts — the same helper the route guard uses, so the
 * sidebar can never offer a screen the guard would bounce. The backend still
 * enforces access on every request; hiding here is UX, not security (§10).
 */
const PortalShell = ({
  sectionLabel,
  children,
}: {
  sectionLabel: string;
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: meApi.get,
    staleTime: 60_000,
  });

  const signOut = () => {
    authService.logout();
    navigate(AUTH_ROUTE, { replace: true });
  };

  const { pathname } = useLocation();

  // The Owner-linked account is the ADMINISTRATION concept, not a person: no
  // employee surfaces at all — it lives in the Admin console (roles &
  // permissions). Landing anywhere else bounces it to /admin. For everyone
  // else, team views only make sense for an RM. Hiding is UX, not security —
  // the backend enforces the real rules regardless.
  useEffect(() => {
    if (me?.isOwner && !pathname.startsWith(ADMIN_ROUTE) && !pathname.startsWith(HR_ROUTE)) {
      navigate(ADMIN_ROUTE, { replace: true });
    }
  }, [me?.isOwner, pathname, navigate]);

  const employeeItems = me?.isOwner
    ? []
    : EMPLOYEE_NAV.filter((item) => !RM_ONLY_ROUTES.includes(item.to) || me?.hasReports);
  const hrItems = me
    ? HR_NAV.filter((item) =>
        (Array.isArray(item.portal) ? item.portal : [item.portal]).some((p) => holdsPortal(me, p)),
      )
    : [];
  const showHr = me !== undefined && canEnterSection(me, APP_SECTION.hr) && hrItems.length > 0;
  const showAdmin = me !== undefined && canEnterSection(me, APP_SECTION.admin);

  return (
    <div className='flex min-h-screen'>
      {/* Pinned to the viewport: the page scrolls, the sidebar doesn't — the
          nav list below scrolls on its own when it outgrows the screen. */}
      <aside className='sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white'>
        <div className='flex items-start justify-between border-b border-slate-200 px-5 py-4'>
          <div>
            <div className='text-lg font-bold text-brand-600'>Elecbits HR</div>
            <div className='text-xs uppercase tracking-wide text-slate-400'>{sectionLabel}</div>
          </div>
          <NotificationBell />
        </div>
        <nav className='flex-1 space-y-1 overflow-y-auto p-3'>
          <NavLinks items={employeeItems} />
          {showHr && <NavGroup label='HR' basePath={HR_ROUTE} items={hrItems} />}
          {showAdmin && <NavGroup label='Admin' basePath={ADMIN_ROUTE} items={ADMIN_NAV} />}
        </nav>
        <button
          type='button'
          onClick={signOut}
          className='m-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100'
        >
          Sign out
        </button>
      </aside>
      {/* min-w-0 lets wide page content wrap instead of overflowing the viewport. */}
      <main className='min-w-0 flex-1 p-8'>{children}</main>
    </div>
  );
};

export default PortalShell;

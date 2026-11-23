import type { Me } from '@app-types/api.types';
import {
  APP_SECTION,
  SECTION_BATCHES,
  type AppSection,
} from '@constants/Common/auth/portal.constants';
import { HR_NAV, type HrNavItem } from '@constants/Common/navigation/nav.constants';
import {
  HOME_ROUTE,
  HR_ASSETS_ROUTE,
  HR_HIRING_ROUTE,
  HR_PAYROLL_ROUTE,
  HR_PEOPLE_ROUTE,
  HR_ROUTE,
} from '@constants/Common/navigation/routes.constants';

/**
 * The ONE place that answers "may this person enter this section" on the
 * frontend. Both the route guard and the sidebar consume it, so what is
 * clickable and what is enterable can never drift apart. The backend still
 * enforces real access on every request (§10) — this is visibility only.
 */
export const canEnterSection = (me: Me, section: AppSection): boolean =>
  section === APP_SECTION.employee ||
  me.isOwner ||
  me.isSuperadmin ||
  (SECTION_BATCHES[section] ?? []).some((batch) => me.batches.includes(batch));

/** May this person see an HR nav item tagged with `portal` (a batch name)? */
export const holdsPortal = (me: Me, portal: string): boolean =>
  me.isOwner || me.isSuperadmin || me.batches.includes(portal);

/** The HR pages this person may open — the sidebar list and the guard both use it. */
export const hrItemsFor = (me: Me): HrNavItem[] =>
  HR_NAV.filter((item) =>
    (Array.isArray(item.portal) ? item.portal : [item.portal]).some((p) => holdsPortal(me, p)),
  );

/** Each HR portal's own main page, in the order a multi-portal person lands. */
const PORTAL_HOME: { portal: string; to: string }[] = [
  { portal: 'HRBP', to: HR_PEOPLE_ROUTE },
  { portal: 'TA', to: HR_HIRING_ROUTE },
  { portal: 'PR', to: HR_PAYROLL_ROUTE },
  { portal: 'OPS', to: HR_ASSETS_ROUTE },
];

/** Plain names for the teams behind each portal batch (for "this page is for …"). */
const PORTAL_TEAM: Record<string, string> = {
  HRBP: 'HR',
  TA: 'hiring (TA)',
  PR: 'payroll',
  OPS: 'OPS',
};

/** The HR page this person starts on: their own portal's main page. */
export const hrHomeFor = (me: Me): string => {
  const own = PORTAL_HOME.find((p) => holdsPortal(me, p.portal));
  return own?.to ?? hrItemsFor(me)[0]?.to ?? HOME_ROUTE;
};

/** "Payroll is for the payroll team." — why an /hr page was refused. */
export const hrDeniedReason = (pathname: string): string | null => {
  const path = pathname.replace(/\/+$/, '');
  const page = HR_NAV.find((item) => path === item.to || path.startsWith(`${item.to}/`));
  if (!page) return null;
  const portals = Array.isArray(page.portal) ? page.portal : [page.portal];
  const teams = portals.map((p) => PORTAL_TEAM[p] ?? p);
  const who =
    teams.length > 1 ? `${teams.slice(0, -1).join(', ')} and ${teams[teams.length - 1]}` : teams[0];
  return `${page.label} is for the ${who} team${teams.length > 1 ? 's' : ''}.`;
};

/** Why a whole console was refused. */
export const sectionDeniedReason = (section: AppSection): string =>
  section === APP_SECTION.admin
    ? 'Admin pages are for the company owner and admins.'
    : 'The HR console is for the HR, hiring, payroll and OPS teams.';

/**
 * Where an /hr path should go: `null` when this person may open it, else
 * their own HR main page (Payroll for PR, Assets for OPS, …). Bare /hr lands
 * there too, so an OPS holder never starts on the HRBP People page.
 */
export const hrRedirectFor = (me: Me, pathname: string): string | null => {
  const allowed = hrItemsFor(me);
  const first = hrHomeFor(me);
  const path = pathname.replace(/\/+$/, '');
  if (path === HR_ROUTE) return first;
  const page = HR_NAV.find((item) => path === item.to || path.startsWith(`${item.to}/`));
  if (page && !allowed.includes(page)) return first;
  return null;
};

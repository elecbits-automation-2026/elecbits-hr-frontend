import type { Me } from '@app-types/api.types';
import {
  APP_SECTION,
  SECTION_BATCHES,
  type AppSection,
} from '@constants/Common/auth/portal.constants';
import { HR_NAV, type HrNavItem } from '@constants/Common/navigation/nav.constants';
import { HOME_ROUTE, HR_ROUTE } from '@constants/Common/navigation/routes.constants';

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

/**
 * Where an /hr path should go: `null` when this person may open it, else the
 * first HR page they may open (or `null` target → home). Bare /hr lands on the
 * first allowed page, so an OPS holder never starts on the HRBP People page.
 */
export const hrRedirectFor = (me: Me, pathname: string): string | null => {
  const allowed = hrItemsFor(me);
  const first = allowed[0]?.to ?? HOME_ROUTE;
  const path = pathname.replace(/\/+$/, '');
  if (path === HR_ROUTE) return first;
  const page = HR_NAV.find((item) => path === item.to || path.startsWith(`${item.to}/`));
  if (page && !allowed.includes(page)) return first;
  return null;
};

import type { Me } from '@app-types/api.types';
import {
  APP_SECTION,
  SECTION_BATCHES,
  type AppSection,
} from '@constants/Common/auth/portal.constants';

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

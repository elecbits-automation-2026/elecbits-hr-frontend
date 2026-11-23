import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AUTH_ROUTE, HOME_ROUTE, HR_ROUTE } from '@constants/Common/navigation/routes.constants';
import { APP_SECTION, type AppSection } from '@constants/Common/auth/portal.constants';
import PrivacyGate from '@components/Common/Privacy/PrivacyGate.component';
import { meApi } from '@services/api/me.api';
import { authService } from '@services/auth.service';
import {
  canEnterSection,
  hrDeniedReason,
  hrRedirectFor,
  sectionDeniedReason,
} from '@utils/sections';
import { toast } from '@utils/toast';

/**
 * A redirect that says why: a shared link to a page this person can't open
 * shouldn't just silently land them somewhere else (one toast per refusal).
 */
const DeniedRedirect = ({ to, reason }: { to: string; reason: string | null }) => {
  useEffect(() => {
    if (reason)
      toast.info(`${reason} You don't have access to it, so you're on your own page instead.`);
  }, [reason]);
  return <Navigate to={to} replace />;
};

/**
 * Route guard. Signed out -> the login screen.
 *
 * `section` names the console this subtree belongs to. Whether the caller may
 * see it comes from GET /me (batches + owner/superadmin flags) — the guard is
 * a convenience only; the backend enforces access on every request, so hiding
 * a screen is UX, not security (design doc §10).
 */
const ProtectedRoute = ({ children, section }: { children: ReactNode; section: AppSection }) => {
  const signedIn = authService.isSignedIn();
  const { pathname } = useLocation();
  const {
    data: me,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['me'],
    queryFn: meApi.get,
    staleTime: 60_000,
    enabled: signedIn,
  });

  if (!signedIn) return <Navigate to={AUTH_ROUTE} replace />;
  if (isLoading) return null;
  // The axios interceptor clears the session on 401; anything else that
  // breaks /me also leaves us unable to decide — back to sign-in.
  if (error || !me) return <Navigate to={AUTH_ROUTE} replace />;

  // Same helper the sidebar uses — visibility and access can never drift.
  if (!canEnterSection(me, section)) {
    return <DeniedRedirect to={HOME_ROUTE} reason={sectionDeniedReason(section)} />;
  }
  // Inside HR, each page belongs to a portal batch: typing a URL must not
  // open another batch's page (e.g. OPS opening TA's Candidates).
  if (section === APP_SECTION.hr) {
    const to = hrRedirectFor(me, pathname);
    if (to) {
      const bare = pathname.replace(/\/+$/, '') === HR_ROUTE;
      return <DeniedRedirect to={to} reason={bare ? null : hrDeniedReason(pathname)} />;
    }
  }
  // The privacy notice must be accepted (per version) before anything else.
  return <PrivacyGate>{children}</PrivacyGate>;
};

export default ProtectedRoute;

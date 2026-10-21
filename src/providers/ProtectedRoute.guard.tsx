import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AUTH_ROUTE, HOME_ROUTE } from '@constants/Common/navigation/routes.constants';
import type { AppSection } from '@constants/Common/auth/portal.constants';
import { meApi } from '@services/api/me.api';
import { authService } from '@services/auth.service';
import { canEnterSection } from '@utils/sections';

/**
 * Route guard. Signed out -> the login screen.
 *
 * `section` names the console this subtree belongs to. Whether the caller may
 * see it comes from GET /me (batches + owner/superadmin flags) — the guard is
 * a convenience only; the backend enforces access on every request, so hiding
 * a screen is UX, not security (design doc §10).
 */
const ProtectedRoute = ({
  children,
  section,
}: {
  children: ReactNode;
  section: AppSection;
}) => {
  const signedIn = authService.isSignedIn();
  const { data: me, isLoading, error } = useQuery({
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
  if (!canEnterSection(me, section)) return <Navigate to={HOME_ROUTE} replace />;
  return <>{children}</>;
};

export default ProtectedRoute;

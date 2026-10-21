import type { ReactNode } from 'react';

import PortalShell from '@components/Common/Navigation/PortalShell.component';

/**
 * The HR console (§1): one console enclosing the four HR portal sections —
 * HRBP / TA / PR / OPS. The shared PortalShell renders the one app-wide
 * sidebar, filtered to the sections the signed-in person holds.
 */
const HrLayout = ({ children }: { children: ReactNode }) => (
  <PortalShell sectionLabel='HR console'>{children}</PortalShell>
);

export default HrLayout;

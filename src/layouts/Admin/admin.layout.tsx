import type { ReactNode } from 'react';

import PortalShell from '@components/Common/Navigation/PortalShell.component';

/** The Owner / SuperAdmin console: the access model's admin surface (§3–§6). */
const AdminLayout = ({ children }: { children: ReactNode }) => (
  <PortalShell sectionLabel='Administration'>{children}</PortalShell>
);

export default AdminLayout;

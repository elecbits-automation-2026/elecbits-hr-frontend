import type { ReactNode } from 'react';

import PortalShell from '@components/Common/Navigation/PortalShell.component';

/** The base surface every employee gets (design doc §1: the Employee box). */
const EmployeeLayout = ({ children }: { children: ReactNode }) => (
  <PortalShell sectionLabel='Employee'>{children}</PortalShell>
);

export default EmployeeLayout;

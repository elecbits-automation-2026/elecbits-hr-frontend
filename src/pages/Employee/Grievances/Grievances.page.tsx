import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import SessionRequests from '@components/Employee/OpenDoor/SessionRequests.component';
import PageTabs from '@components/Common/Tabs/PageTabs.component';
import ConcernsPage from '@pages/Employee/Concerns/Concerns.page';
import OpenDoorPage from '@pages/Employee/OpenDoor/OpenDoor.page';
import { openDoorApi } from '@services/api/openDoor.api';

const TABS = ['concerns', 'open-door', 'requests'] as const;
type Tab = (typeof TABS)[number];

/**
 * Grievances (test-pass fix 2026-10-22): one home for everything that the
 * hrbp.grievances grant powers — formal concerns, open-door sessions, and
 * session requests. The tab lives in `?tab=` so notification links land on
 * the right one; /concerns and /open-door redirect here.
 */
const GrievancesPage = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'concerns';
  const requests = useQuery({ queryKey: ['open-door-requests'], queryFn: openDoorApi.requests });
  const waitingOnMe = (requests.data?.incoming ?? []).filter(
    (r) => r.status === 'requested',
  ).length;

  return (
    <div className='w-full max-w-4xl space-y-4'>
      <div>
        <h1 className='text-2xl font-semibold text-slate-800'>Grievances</h1>
        <p className='text-sm text-slate-500'>
          Raise a concern formally, or talk to someone — book an open-door slot or ask for a time.
        </p>
      </div>
      <PageTabs
        tabs={[
          { key: 'concerns', label: 'Concerns' },
          { key: 'open-door', label: 'Open door' },
          { key: 'requests', label: 'Requests', count: waitingOnMe },
        ]}
        active={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
      />
      {tab === 'concerns' && <ConcernsPage embedded />}
      {tab === 'open-door' && <OpenDoorPage embedded />}
      {tab === 'requests' && <SessionRequests />}
    </div>
  );
};

export default GrievancesPage;

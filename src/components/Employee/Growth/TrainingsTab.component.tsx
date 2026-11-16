import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import TrainingList from '@components/Common/Trainings/TrainingList.component';
import { AssignTrainingModal } from '@components/Common/Trainings/TrainingModals.component';
import { meApi } from '@services/api/me.api';
import { trainingsApi } from '@services/api/trainings.api';
import { apiErrorMessage } from '@utils/apiError';

/**
 * Career path → Trainings: my own (mark done, attach a certificate) and, for
 * a manager, the team's — with "Assign a training" for their reports.
 */
const TrainingsTab = ({ isRm }: { isRm: boolean }) => {
  const [assigning, setAssigning] = useState(false);
  const mine = useQuery({ queryKey: ['trainings-mine'], queryFn: trainingsApi.mine });
  const team = useQuery({
    queryKey: ['trainings-team'],
    queryFn: trainingsApi.team,
    enabled: isRm,
  });
  const people = useQuery({ queryKey: ['my-team'], queryFn: meApi.team, enabled: isRm });

  return (
    <div className='space-y-6'>
      <section className='space-y-2'>
        <h2 className='text-sm font-semibold text-slate-800'>My trainings</h2>
        {mine.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {mine.error && <p className='text-sm text-red-600'>{apiErrorMessage(mine.error)}</p>}
        {mine.data && (
          <TrainingList
            trainings={mine.data}
            mode='mine'
            empty='Nothing assigned to you right now.'
          />
        )}
      </section>

      {isRm && (
        <section className='space-y-2'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <h2 className='text-sm font-semibold text-slate-800'>My team&rsquo;s trainings</h2>
            <button
              type='button'
              onClick={() => setAssigning(true)}
              disabled={!people.data?.length}
              className='rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
            >
              Assign a training
            </button>
          </div>
          {team.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
          {team.error && <p className='text-sm text-red-600'>{apiErrorMessage(team.error)}</p>}
          {team.data && (
            <TrainingList
              trainings={team.data}
              mode='manage'
              showPerson
              empty='No open trainings in your team.'
            />
          )}
        </section>
      )}

      {assigning && people.data && (
        <AssignTrainingModal
          people={people.data.map((p) => ({ id: p.id, name: p.name, department: p.department }))}
          onClose={() => setAssigning(false)}
        />
      )}
    </div>
  );
};

export default TrainingsTab;

import { useQueryClient } from '@tanstack/react-query';

/** Every cached trainings view — refreshed after any change. */
export const useTrainingsInvalidate = () => {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['trainings-mine', 'trainings-team', 'trainings-all', 'trainings-person']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
};

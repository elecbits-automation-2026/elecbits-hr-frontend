import { useQuery } from '@tanstack/react-query';

import { settingsApi } from '@services/api/settings.api';

/** The state names in payroll.ptStates — for "where is this person based" pickers. */
export const usePtStates = (): string[] => {
  const settings = useQuery({
    queryKey: ['settings', 'payroll'],
    queryFn: () => settingsApi.list('payroll'),
  });
  const pt = settings.data?.find((s) => s.key === 'payroll.ptStates')?.value as
    { states: Array<{ state: string }> } | undefined;
  return (pt?.states ?? []).map((st) => st.state);
};

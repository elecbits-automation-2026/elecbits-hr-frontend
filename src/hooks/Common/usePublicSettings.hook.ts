import { useQuery } from '@tanstack/react-query';

import { CITATION_MIN_LENGTH, REGULARIZE_WINDOW_DAYS } from '@constants/Common/rules.constants';
import { settingsApi } from '@services/api/settings.api';

/**
 * Org settings that shape employee-side hints (work hours, work week, leave
 * window), plus the fixed citation minimum and regularize window. Each getter falls back to the built-in default, so a
 * failed or pending fetch never blocks the form — the backend enforces the
 * real value either way.
 */
export const usePublicSettings = () => {
  const query = useQuery({
    queryKey: ['settings-public'],
    queryFn: settingsApi.publicValues,
    staleTime: 5 * 60_000,
  });
  const values = query.data ?? {};
  return {
    citationMinLength: CITATION_MIN_LENGTH,
    regularizeWindowDays: REGULARIZE_WINDOW_DAYS,
    workHours: values['attendance.workHours'] ?? null,
    workWeek: values['attendance.workWeek'] ?? {
      saturdays: 'first_third_off' as const,
      effectiveFrom: '2026-11-01',
    },
    icContact: values['concerns.icContact']?.contact ?? '',
    leaveWindowDays: values['leaves.applicationWindowDays'] ?? { earned: 7, vacation_family: 7 },
  };
};

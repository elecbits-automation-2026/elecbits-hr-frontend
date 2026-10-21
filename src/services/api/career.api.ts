import type {
  CareerTrack,
  CareerTrackNote,
  MyCareer,
  OpenCareerTrackInput,
  PersonCareer,
  TeamCareerRow,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Career ladder & roadmap conversations — relationship-gated server-side. */
export const careerApi = {
  mine: async (): Promise<MyCareer> => (await api.get<MyCareer>('/career/mine')).data,
  request: async (): Promise<CareerTrack> => (await api.post<CareerTrack>('/career/request')).data,
  team: async (): Promise<TeamCareerRow[]> => (await api.get<TeamCareerRow[]>('/career/team')).data,
  openTrack: async (input: OpenCareerTrackInput): Promise<CareerTrack> =>
    (await api.post<CareerTrack>('/career/tracks', input)).data,
  closeTrack: async (
    id: string,
    input: { outcome: 'met' | 'closed'; reason?: string },
  ): Promise<CareerTrack> =>
    (await api.post<CareerTrack>(`/career/tracks/${id}/close`, input)).data,
  /** RM-or-HR only; the employee is notified. */
  addNote: async (trackId: string, body: string): Promise<CareerTrackNote> =>
    (await api.post<CareerTrackNote>(`/career/tracks/${trackId}/notes`, { body })).data,
  /** One person's history, open track and notes — RM-or-HR. */
  person: async (employeeId: string): Promise<PersonCareer> =>
    (await api.get<PersonCareer>(`/career/people/${employeeId}`)).data,
};

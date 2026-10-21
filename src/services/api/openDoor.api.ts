import type { OpenDoorMe, OpenDoorSlot } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Open door: HR and department heads publish times they are free to talk;
 * anyone books a seat. The topic is seen by the slot's owner only.
 */
export const openDoorApi = {
  slots: async (): Promise<OpenDoorSlot[]> =>
    (await api.get<OpenDoorSlot[]>('/open-door/slots')).data,
  me: async (): Promise<OpenDoorMe> => (await api.get<OpenDoorMe>('/open-door/me')).data,
  createSlot: async (input: {
    date: string;
    startTime: string;
    endTime: string;
    capacity?: number;
    note?: string;
  }): Promise<OpenDoorMe> => (await api.post<OpenDoorMe>('/open-door/slots', input)).data,
  cancelSlot: async (id: string): Promise<OpenDoorMe> =>
    (await api.post<OpenDoorMe>(`/open-door/slots/${id}/cancel`)).data,
  book: async (id: string, topic?: string): Promise<void> => {
    await api.post(`/open-door/slots/${id}/book`, topic ? { topic } : {});
  },
  cancelBooking: async (id: string): Promise<OpenDoorMe> =>
    (await api.post<OpenDoorMe>(`/open-door/bookings/${id}/cancel`)).data,
  mark: async (id: string, status: 'done' | 'no_show'): Promise<OpenDoorMe> =>
    (await api.post<OpenDoorMe>(`/open-door/bookings/${id}/mark`, { status })).data,
};

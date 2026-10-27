import type {
  CreateOpenDoorRequestInput,
  OpenDoorHost,
  OpenDoorMe,
  OpenDoorRequests,
  OpenDoorSlot,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Open door: HR and department heads publish times they are free to talk;
 * anyone books a seat. The topic is seen by the slot's owner only. When no
 * slot suits, a session can be REQUESTED — of a host, or of whoever handles
 * your named concern; they offer a time or decline.
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

  // Session requests
  hosts: async (): Promise<OpenDoorHost[]> =>
    (await api.get<OpenDoorHost[]>('/open-door/hosts')).data,
  requests: async (): Promise<OpenDoorRequests> =>
    (await api.get<OpenDoorRequests>('/open-door/requests')).data,
  createRequest: async (input: CreateOpenDoorRequestInput): Promise<OpenDoorRequests> =>
    (await api.post<OpenDoorRequests>('/open-door/requests', input)).data,
  offerRequest: async (
    id: string,
    input: { date: string; startTime: string; endTime: string; note?: string },
  ): Promise<OpenDoorRequests> =>
    (await api.post<OpenDoorRequests>(`/open-door/requests/${id}/offer`, input)).data,
  declineRequest: async (id: string, reason: string): Promise<OpenDoorRequests> =>
    (await api.post<OpenDoorRequests>(`/open-door/requests/${id}/decline`, { reason })).data,
  cancelRequest: async (id: string): Promise<OpenDoorRequests> =>
    (await api.post<OpenDoorRequests>(`/open-door/requests/${id}/cancel`)).data,
};

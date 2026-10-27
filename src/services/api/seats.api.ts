import type { Seat, SeatKind, SeatsOverview } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/** Seats: dept head (per department) and VP — assigned by HR. */
export const seatsApi = {
  overview: async (): Promise<SeatsOverview> => (await api.get<SeatsOverview>('/seats')).data,
  assign: async (input: {
    seat: SeatKind;
    departmentId?: string;
    employeeId: string;
    acting: boolean;
  }): Promise<Seat> => (await api.put<Seat>('/seats', input)).data,
  vacate: async (input: { seat: SeatKind; departmentId?: string }): Promise<void> => {
    await api.post('/seats/vacate', input);
  },
};

import type {
  DecideLeaveInput,
  EmployeeAttendance,
  Holiday,
  MyAttendance,
  PunchZone,
  Regularization,
  WfhRequest,
} from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * Attendance: punches, classified month views, holidays, and the two
 * RM-approved request flows (regularization, WFH). Self views are keyed to
 * the caller server-side; the org view sits behind hrbp.attendance.
 */
export const attendanceApi = {
  // Geo policy: inside the office radius punches clean; inside the flag
  // radius it records remote (flagged); beyond that the backend rejects the
  // punch unless an approved remote-work request covers today.
  checkIn: async (coords?: { lat: number; lng: number }) =>
    (await api.post('/attendance/check-in', coords ?? {})).data,
  checkOut: async (coords?: { lat: number; lng: number }) =>
    (await api.post('/attendance/check-out', coords ?? {})).data,
  me: async (month?: string): Promise<MyAttendance> =>
    (await api.get<MyAttendance>('/attendance/me', { params: { month } })).data,
  team: async (month?: string): Promise<EmployeeAttendance[]> =>
    (await api.get<EmployeeAttendance[]>('/attendance/team', { params: { month } })).data,
  org: async (
    month?: string,
    zoneId?: string,
    departmentId?: string,
  ): Promise<EmployeeAttendance[]> =>
    (
      await api.get<EmployeeAttendance[]>('/attendance/org', {
        params: { month, zone: zoneId, department: departmentId },
      })
    ).data,

  // Punch zones — Admin (Owner/SuperAdmin) only.
  listZones: async (): Promise<PunchZone[]> =>
    (await api.get<PunchZone[]>('/attendance/zones')).data,
  addZone: async (input: {
    name: string;
    lat: number;
    lng: number;
    radiusM: number;
    workStart?: string | null;
    workEnd?: string | null;
  }): Promise<PunchZone> => (await api.post<PunchZone>('/attendance/zones', input)).data,
  removeZone: async (id: string): Promise<void> => {
    await api.delete(`/attendance/zones/${id}`);
  },

  // HR marks a missed day directly (regularized; attached single-day leave
  // is revoked + refunded).
  hrMark: async (input: {
    employeeId: string;
    date: string;
    checkInAt: string;
    checkOutAt: string;
  }) => (await api.post('/attendance/hr-mark', input)).data,

  // CSV export (HRBP or PR) — returns the raw CSV text.
  exportCsv: async (month: string, departmentId?: string, zoneId?: string): Promise<string> =>
    (
      await api.get<string>('/attendance/export', {
        params: { month, department: departmentId, zone: zoneId },
        responseType: 'text',
        transformResponse: [(d) => d],
      })
    ).data,

  holidays: async (year?: number): Promise<Holiday[]> =>
    (await api.get<Holiday[]>('/attendance/holidays', { params: { year } })).data,
  addHoliday: async (input: { date: string; name: string }): Promise<Holiday> =>
    (await api.post<Holiday>('/attendance/holidays', input)).data,
  removeHoliday: async (id: string): Promise<void> => {
    await api.delete(`/attendance/holidays/${id}`);
  },

  raiseRegularization: async (input: {
    date: string;
    proposedIn: string;
    proposedOut: string;
    reason?: string;
  }): Promise<Regularization> =>
    (await api.post<Regularization>('/attendance/regularizations', input)).data,
  myRegularizations: async (): Promise<Regularization[]> =>
    (await api.get<Regularization[]>('/attendance/regularizations/mine')).data,
  teamRegularizations: async (): Promise<Regularization[]> =>
    (await api.get<Regularization[]>('/attendance/regularizations/team')).data,
  decideRegularization: async (id: string, input: DecideLeaveInput): Promise<Regularization> =>
    (await api.post<Regularization>(`/attendance/regularizations/${id}/decision`, input)).data,
  cancelRegularization: async (id: string): Promise<Regularization> =>
    (await api.post<Regularization>(`/attendance/regularizations/${id}/cancel`)).data,

  raiseWfh: async (input: {
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<WfhRequest> => (await api.post<WfhRequest>('/attendance/wfh', input)).data,
  myWfh: async (): Promise<WfhRequest[]> =>
    (await api.get<WfhRequest[]>('/attendance/wfh/mine')).data,
  teamWfh: async (): Promise<WfhRequest[]> =>
    (await api.get<WfhRequest[]>('/attendance/wfh/team')).data,
  wfhQueue: async (): Promise<WfhRequest[]> =>
    (await api.get<WfhRequest[]>('/attendance/wfh/queue')).data,
  decideWfh: async (id: string, input: DecideLeaveInput): Promise<WfhRequest> =>
    (await api.post<WfhRequest>(`/attendance/wfh/${id}/decision`, input)).data,
  cancelWfh: async (id: string): Promise<WfhRequest> =>
    (await api.post<WfhRequest>(`/attendance/wfh/${id}/cancel`)).data,
};

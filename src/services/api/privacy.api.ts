import { api } from '@utils/axiosInstance';

/** GET /me/privacy — the current notice and whether the caller still has to accept it. */
export interface PrivacyStatus {
  version: string;
  text: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  required: boolean;
}

/** GET /admin/privacy/retention — what the purge job would remove today. */
export interface RetentionPreview {
  purgeEnabled: boolean;
  periods: { gpsMonths: number; medicalCertificateMonths: number; exEmployeeYears: number };
  cutoffs: { gps: string; medical: string; exEmployee: string };
  wouldRemove: {
    punchLocations: number;
    medicalCertificates: number;
    exEmployeeContactRecords: number;
  };
}

/** Privacy (DPDP Act 2023): notice acceptance, download my data, retention preview. */
export const privacyApi = {
  status: async (): Promise<PrivacyStatus> => (await api.get<PrivacyStatus>('/me/privacy')).data,
  accept: async (version: string): Promise<PrivacyStatus> =>
    (await api.post<PrivacyStatus>('/me/privacy/accept', { version })).data,
  /** The caller's own records as one JSON file, downloaded by the browser. */
  downloadMyData: async (): Promise<void> => {
    const res = await api.get<unknown>('/me/export');
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-elecbits-hr-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  retention: async (): Promise<RetentionPreview> =>
    (await api.get<RetentionPreview>('/admin/privacy/retention')).data,
};

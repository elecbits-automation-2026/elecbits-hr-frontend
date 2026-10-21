import { AxiosError } from 'axios';

/**
 * Extract the human-readable message from the backend's stable error envelope:
 *   { error: { message, code }, requestId }
 * Falls back to Axios/network wording so a failed request never surfaces as
 * "[object Object]".
 */
export const apiErrorMessage = (err: unknown): string => {
  if (err instanceof AxiosError) {
    const message = err.response?.data?.error?.message;
    if (typeof message === 'string' && message.length > 0) return message;
    if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the backend running?';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
};

/** The machine-readable code, for branching (e.g. CLAIM_CLOSED vs INVALID_CREDENTIALS). */
export const apiErrorCode = (err: unknown): string | undefined =>
  err instanceof AxiosError ? err.response?.data?.error?.code : undefined;

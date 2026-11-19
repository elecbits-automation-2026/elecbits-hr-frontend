import type { AssistantEvent, AssistantTurn } from '@app-types/api.types';
import { useAuthStore } from '@store/auth.store';
import { apiBaseURL, endSession, renewAccessToken } from '@utils/axiosInstance';

/** A refusal from the API before the stream opened (same envelope as axios errors). */
export type AssistantError = Error & { code: string };

const assistantError = (message: string, code: string): AssistantError =>
  Object.assign(new Error(message), { code });

const post = (messages: AssistantTurn[], signal: AbortSignal) =>
  fetch(`${apiBaseURL}/assistant/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ''}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  });

/**
 * HR Assistant — the answer streams as server-sent events, so this is a
 * raw `fetch` (axios can't stream a POST in the browser). Auth mirrors the
 * axios instance: Bearer token, one renewal on a 401, sign-out if that fails.
 * Chats are never stored: the caller sends the text turns each time.
 */
export const assistantApi = {
  chat: async (
    messages: AssistantTurn[],
    onEvent: (e: AssistantEvent) => void,
    signal: AbortSignal,
  ): Promise<void> => {
    let res = await post(messages, signal);
    if (res.status === 401) {
      try {
        await renewAccessToken();
      } catch {
        endSession();
        throw assistantError('Your session has ended', 'UNAUTHENTICATED');
      }
      res = await post(messages, signal);
    }
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string; code?: string };
      } | null;
      throw assistantError(
        body?.error?.message ?? 'The assistant is not available right now',
        body?.error?.code ?? 'ASSISTANT_FAILED',
      );
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      // Events are separated by a blank line; keep any partial tail for later.
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const data = part
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (data) onEvent(JSON.parse(data) as AssistantEvent);
      }
    }
  },
};

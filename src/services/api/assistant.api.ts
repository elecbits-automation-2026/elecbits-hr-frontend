import type {
  AssignTrainingInput,
  AssistantEvent,
  AssistantProposal,
  AssistantQuickQuestion,
  AssistantQuickResult,
  AssistantTurn,
  CreateGoalInput,
  CreateRecognitionInput,
  RequisitionInput,
} from '@app-types/api.types';
import { useAuthStore } from '@store/auth.store';
import { api, apiBaseURL, endSession, renewAccessToken } from '@utils/axiosInstance';

import { hiringApi } from './hiring.api';
import { performanceApi } from './performance.api';
import { recognitionsApi } from './recognitions.api';
import { trainingsApi } from './trainings.api';

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

  /** The offline buttons: one whitelisted read, answered without the model. */
  /** Would the Assistant answer me? Same rule as chat (switch on, HR or a manager). */
  access: async (): Promise<{ allowed: boolean }> =>
    (await api.get<{ allowed: boolean }>('/assistant/access')).data,

  quick: async (question: AssistantQuickQuestion): Promise<AssistantQuickResult> =>
    (await api.post<AssistantQuickResult>('/assistant/quick', { question })).data,

  /**
   * Confirm a proposal: the EXISTING endpoint for that action, called with
   * the user's own session — the app's own write path and access checks.
   * The payload was built and validated by the server against that
   * endpoint's schema; the endpoint validates it again.
   */
  /** Resolves to a one-line outcome for the card. */
  confirm: async (p: AssistantProposal): Promise<string> => {
    switch (p.action) {
      case 'add_goal':
        await performanceApi.createGoal(p.payload as unknown as CreateGoalInput);
        return 'Goal added.';
      case 'assign_training': {
        const r = await trainingsApi.assign(p.payload as unknown as AssignTrainingInput);
        const skipped = r.skipped.length
          ? ` Skipped (already has it open): ${r.skipped.map((x) => x.name).join(', ')}.`
          : '';
        return `Assigned to ${r.assigned} ${r.assigned === 1 ? 'person' : 'people'}.${skipped}`;
      }
      case 'nominate':
        await recognitionsApi.nominate(p.payload as unknown as CreateRecognitionInput);
        return 'Nomination sent to HR for approval.';
      case 'raise_opening':
        await hiringApi.create(
          p.payload as unknown as RequisitionInput & { departmentId: string; quarter: string },
        );
        return 'Saved as a draft line — submit it from Hiring plan.';
    }
  },
};

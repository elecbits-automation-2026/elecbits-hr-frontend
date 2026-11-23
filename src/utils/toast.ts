/**
 * The app's toasts: a tiny module-level store, so anything can raise one —
 * a component, a hook, or the React Query MutationCache — without a context.
 * <Toaster /> (mounted once in AppProviders) renders the stack.
 *
 *   toast.success('Saved');  toast.error(apiErrorMessage(err));  toast.info('…');
 *
 * Mutations get them without calling this at all (providers/queryClient.ts):
 *   - an error toast is shown for EVERY failed mutation, with the server's
 *     message; pass `meta: { silentError: true }` when the screen already
 *     shows that error inline (or handles it itself);
 *   - a success toast is opt-in: `meta: { successMessage: 'Slot published' }`.
 */
export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const DURATION_MS: Record<ToastKind, number> = { success: 3500, info: 4500, error: 6500 };
const MAX_SHOWN = 4;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const emit = () => listeners.forEach((l) => l());

export const dismissToast = (id: number): void => {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  items = items.filter((i) => i.id !== id);
  emit();
};

const push = (kind: ToastKind, message: string): number => {
  const text = message.trim();
  if (!text) return 0;
  // The same message already showing (a double click, a retry): don't stack it.
  const same = items.find((i) => i.kind === kind && i.message === text);
  if (same) return same.id;
  const id = nextId++;
  items = [...items, { id, kind, message: text }].slice(-MAX_SHOWN);
  timers.set(
    id,
    setTimeout(() => dismissToast(id), DURATION_MS[kind]),
  );
  emit();
  return id;
};

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

/** For useSyncExternalStore in <Toaster />. */
export const subscribeToasts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const readToasts = (): ToastItem[] => items;

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard handling for a modal dialog / drawer (WCAG 2.4.3):
 *  - moves focus into the dialog when it opens (the first field, else the
 *    first focusable control, else the dialog itself);
 *  - keeps Tab / Shift+Tab inside it (focus trap);
 *  - hands focus back to whatever had it before when the dialog closes.
 * Attach the returned ref to the element with role='dialog' and aria-modal.
 */
export const useDialogFocus = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      );

    const first =
      el.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select, textarea',
      ) ?? focusables()[0];
    if (first) first.focus();
    else {
      el.tabIndex = -1;
      el.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const head = items[0]!;
      const tail = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === head || !el.contains(document.activeElement))) {
        e.preventDefault();
        tail.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === tail || !el.contains(document.activeElement))
      ) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return ref;
};

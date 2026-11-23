import { useEffect } from 'react';

import { useDialogFocus } from '@hooks/Common/useDialogFocus.hook';

/**
 * The centred-modal backdrop every popup form uses, as a real dialog:
 * role='dialog' + aria-modal, named after its first heading, focus moved in
 * on open, Tab kept inside, focus handed back on close (WCAG 2.4.3 / 4.1.2).
 * Pass `onClose` to also close on Escape.
 */
const ModalShell = ({
  children,
  onClose,
  className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4',
}: {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}) => {
  const ref = useDialogFocus<HTMLDivElement>();

  useEffect(() => {
    const el = ref.current;
    if (!el || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
    const heading = el.querySelector<HTMLElement>('h1, h2, h3');
    if (!heading) return;
    if (!heading.id) heading.id = `dlg-${Math.random().toString(36).slice(2, 9)}`;
    el.setAttribute('aria-labelledby', heading.id);
  }, [ref]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div ref={ref} role='dialog' aria-modal='true' className={className}>
      {children}
    </div>
  );
};

export default ModalShell;

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** A panel that slides over the page from the right; Esc or the backdrop closes it. */
const Drawer = ({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className='fixed inset-0 z-40 flex justify-end bg-slate-900/30' onClick={onClose}>
      <aside
        role='dialog'
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full flex-col bg-white shadow-xl ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}
      >
        <header className='flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4'>
          <div className='min-w-0'>
            <h2 className='truncate text-lg font-semibold text-slate-800'>{title}</h2>
            {subtitle && <p className='text-xs text-slate-500'>{subtitle}</p>}
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700'
          >
            ×
          </button>
        </header>
        <div className='flex-1 space-y-4 overflow-y-auto px-5 py-4'>{children}</div>
      </aside>
    </div>,
    document.body,
  );
};

export default Drawer;

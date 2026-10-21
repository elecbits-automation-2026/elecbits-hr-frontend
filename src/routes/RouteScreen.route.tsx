import { Suspense, type ReactNode } from 'react';

import { useDocumentTitle } from '@hooks/Common/useDocumentTitle.hook';

/**
 * The wrapper every route element sits in: sets the document title and covers
 * the lazy chunk's load with a Suspense fallback, so route files stay free of
 * both concerns.
 */
const RouteScreen = ({ title, children }: { title?: string; children: ReactNode }) => {
  useDocumentTitle(title);

  return (
    <Suspense
      fallback={
        <div className='flex min-h-[40vh] items-center justify-center text-sm text-slate-400'>
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  );
};

export default RouteScreen;

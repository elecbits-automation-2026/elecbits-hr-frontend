import { useEffect } from 'react';

/** Set the tab title for the mounted screen; restore nothing on unmount — the
 *  next screen sets its own. */
export const useDocumentTitle = (title?: string): void => {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
};

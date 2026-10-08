'use client';

import { useEffect } from 'react';

/**
 * Asks the browser to confirm before the tab closes or reloads while
 * `isActive` (for instance, unsaved changes). In-app navigation is not
 * intercepted: the App Router offers no supported hook for it.
 */
export function useBeforeUnloadGuard(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isActive]);
}

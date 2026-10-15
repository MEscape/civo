import { useEffect, useRef, useState } from 'react';

import { useReportUnsavedChanges } from '@components/shared/unsaved-changes-guard';

export interface DraftGuard {
  /** The draft as it is now has been saved: leaving no longer loses anything. */
  readonly markSaved: () => void;
}

/**
 * Reports a form's draft as unsaved work while it differs from what it started
 * with, to the screen's `UnsavedChangesGuard`. A form that stays open after
 * saving calls `markSaved`; one that closes needs nothing, as unmounting
 * withdraws its report.
 */
export function useDraftGuard(draft: unknown): DraftGuard {
  const current = JSON.stringify(draft);
  const [saved, setSaved] = useState(current);
  const latest = useRef(current);

  useEffect(() => {
    latest.current = current;
  }, [current]);
  useReportUnsavedChanges(current !== saved);

  return {
    markSaved() {
      setSaved(latest.current);
    },
  };
}

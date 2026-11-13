'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';

import { useBeforeUnloadGuard } from './use-before-unload-guard';
import { useUnsavedNavigationGuard } from './use-unsaved-navigation-guard';

interface UnsavedChangesRegistry {
  readonly report: (id: string, isDirty: boolean) => void;
}

export const UnsavedChangesContext = createContext<UnsavedChangesRegistry | null>(null);

/** One guard covers every form in a settings screen; saving one form never clears another's work. */
export function useUnsavedChangesRegistry() {
  const [dirtyForms, setDirtyForms] = useState<ReadonlySet<string>>(new Set());
  const report = useCallback((id: string, isDirty: boolean) => {
    setDirtyForms((current) => {
      if (current.has(id) === isDirty) {
        return current;
      }
      const next = new Set(current);
      if (isDirty) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);
  const registry = useMemo(() => ({ report }), [report]);
  const isDirty = dirtyForms.size > 0;
  useBeforeUnloadGuard(isDirty);
  const navigation = useUnsavedNavigationGuard(isDirty);
  return { registry, navigation };
}

/** Standalone forms retain browser unload protection; a provider also coordinates in-app navigation. */
export function useReportUnsavedChanges(isDirty: boolean): void {
  const registry = useContext(UnsavedChangesContext);
  const id = useId();
  useBeforeUnloadGuard(registry === null && isDirty);
  useEffect(() => {
    registry?.report(id, isDirty);
    return () => {
      registry?.report(id, false);
    };
  }, [registry, id, isDirty]);
}

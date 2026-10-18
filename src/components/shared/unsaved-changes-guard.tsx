'use client';

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';
import { useUnsavedNavigationGuard } from '@hooks/use-unsaved-navigation-guard';

import { ConfirmDialog } from './confirm-dialog';

type ReportUnsaved = (reporterId: string, isDirty: boolean) => void;

const UnsavedChangesContext = createContext<ReportUnsaved | null>(null);

export interface UnsavedChangesGuardProps {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly children: ReactNode;
}

/**
 * Guards a whole screen made of several forms: each one reports whether it
 * holds unsaved work (`useReportUnsavedChanges`), and while any does, leaving
 * through an in-app link asks first (`ConfirmDialog`) and closing or reloading
 * the tab asks through the browser. Leaving discards the work for real: Cache
 * Components keep a left page mounted but hidden (`<Activity>`), so the forms
 * are remounted, or the discarded edits would be back on return.
 */
export function UnsavedChangesGuard({
  title,
  description,
  confirmLabel,
  cancelLabel,
  children,
}: UnsavedChangesGuardProps) {
  const [dirtyReporters, setDirtyReporters] = useState<ReadonlySet<string>>(new Set());
  // Bumped on a confirmed leave: a new key remounts every form with its saved values.
  const [generation, setGeneration] = useState(0);
  const isDirty = dirtyReporters.size > 0;

  const report = useCallback<ReportUnsaved>((reporterId, reporterIsDirty) => {
    setDirtyReporters((current) => {
      if (current.has(reporterId) === reporterIsDirty) {
        return current;
      }
      const next = new Set(current);
      if (reporterIsDirty) {
        next.add(reporterId);
      } else {
        next.delete(reporterId);
      }
      return next;
    });
  }, []);

  useBeforeUnloadGuard(isDirty);
  const leaveGuard = useUnsavedNavigationGuard(isDirty);

  return (
    <UnsavedChangesContext.Provider value={report}>
      <Fragment key={generation}>{children}</Fragment>
      <ConfirmDialog
        open={leaveGuard.isPrompting}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={() => {
          leaveGuard.confirm();
          setGeneration((current) => current + 1);
        }}
        onCancel={leaveGuard.cancel}
      />
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Tells the surrounding `UnsavedChangesGuard` whether this form holds unsaved
 * work. Outside a guard it does nothing; a form that unmounts (saved,
 * cancelled) no longer counts.
 */
export function useReportUnsavedChanges(isDirty: boolean): void {
  const report = useContext(UnsavedChangesContext);
  const reporterId = useId();

  useEffect(() => {
    report?.(reporterId, isDirty);
    return () => {
      report?.(reporterId, false);
    };
  }, [report, reporterId, isDirty]);
}

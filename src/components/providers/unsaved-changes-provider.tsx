'use client';

import type { ReactNode } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';

import { UnsavedChangesContext, useUnsavedChangesRegistry } from '@hooks/use-unsaved-changes';

interface UnsavedChangesProviderProps {
  readonly children: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

/** Coordinates dirty forms and asks once before an in-app navigation discards their changes. */
export function UnsavedChangesProvider({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: UnsavedChangesProviderProps) {
  const { registry, navigation } = useUnsavedChangesRegistry();
  return (
    <UnsavedChangesContext value={registry}>
      {children}
      <ConfirmDialog
        open={navigation.isPrompting}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={navigation.confirm}
        onCancel={navigation.cancel}
      />
    </UnsavedChangesContext>
  );
}

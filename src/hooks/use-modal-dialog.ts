'use client';

import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';

interface ModalDialogOptions {
  /** The state owns visibility: the dialog is shown while it is `true`. */
  readonly open: boolean;
  /** Both answers, Escape included, are out of reach while an action runs. */
  readonly isPending: boolean;
  readonly onCancel: () => void;
}

/**
 * The behaviour of a modal on the platform's `<dialog>`: it is shown and closed as `open` says,
 * the way back holds the initial focus, and Escape answers "cancel" unless an action is pending.
 */
export function useModalDialog({ open, isPending, onCancel }: ModalDialogOptions) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, dialog]);

  return {
    dialog,
    setDialog,
    cancelRef,
    handlers: {
      onCancel: (event: SyntheticEvent) => {
        // The state owns visibility; closing happens through `open`.
        event.preventDefault();
        if (!isPending) {
          onCancel();
        }
      },
      onClose: () => {
        // Some browsers close a dialog natively on a repeated Escape even after
        // `cancel` was prevented. Keep the element in step with `open`.
        if (open && dialog !== null) {
          if (isPending) {
            dialog.showModal();
          } else {
            onCancel();
          }
        }
      },
    },
  };
}

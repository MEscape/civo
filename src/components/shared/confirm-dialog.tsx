'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';
import { PortalContainerContext } from '@components/ui/portal-container';

import { cn } from '@lib/utils';

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  /** The action that goes ahead. */
  readonly confirmLabel: string;
  /** `destructive` (the default) when it gives something up; `default` when it only goes ahead. */
  readonly confirmVariant?: 'destructive' | 'default';
  /** What the question needs beside its words: a list of what will happen, a field for a note. */
  readonly children?: ReactNode;
  /** Both answers are out of reach while the confirmed action runs. */
  readonly isPending?: boolean;
  readonly size?: 'md' | 'lg';
  /** The way back. It holds the initial focus, so a stray Enter keeps the visitor's work. */
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * A modal question with two answers, on the platform's `<dialog>`: it traps
 * focus, makes the page behind it inert, closes on Escape (which answers
 * "cancel") and hands focus back to what had it before.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'destructive',
  children,
  isPending = false,
  size = 'md',
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

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

  return (
    <dialog
      ref={setDialog}
      role={confirmVariant === 'destructive' ? 'alertdialog' : 'dialog'}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // The state owns visibility; closing happens through `open`.
        event.preventDefault();
        onCancel();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] text-start rounded-token border border-border bg-surface p-6 text-copy backdrop:bg-copy/50',
        size === 'lg' ? 'max-w-lg' : 'max-w-md',
      )}
    >
      <h2 id={titleId} className="font-heading text-lg font-semibold text-copy">
        {title}
      </h2>
      <p id={descriptionId} className="mt-2 text-sm text-copy-muted">
        {description}
      </p>
      {children !== undefined && (
        <PortalContainerContext value={dialog}>
          <div className="mt-4">{children}</div>
        </PortalContainerContext>
      )}
      <div
        className={cn(
          'mt-6 flex flex-wrap gap-2',
          // The way back sits first when going ahead is the ordinary answer.
          confirmVariant === 'default' ? 'flex-row-reverse justify-start' : 'justify-end',
        )}
      >
        <Button type="button" variant={confirmVariant} disabled={isPending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}

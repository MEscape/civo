'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';

import { ArrowRight } from '@components/icons/icons';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { PortalContainerContext } from '@components/ui/portal-container';

import { useModalDialog } from '@hooks/use-modal-dialog';

import { Link, useRouter } from '@i18n';

import { cn } from '@lib/utils';

/* -------------------------------------------------------------------------- */
/* DialogNotice                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a dialog says about its own state: the refusal of what was asked, the problems of what was typed, a
 * word of warning. One look in every dialog (the same box, size and spacing wherever it sits, also in a
 * dialog that opens another), and it is read out when it appears: a refusal as an alert, the rest as status.
 */
export function DialogNotice({
  tone,
  children,
}: {
  readonly tone: 'danger' | 'warning' | 'success' | 'info';
  readonly children: ReactNode;
}) {
  return (
    <Alert variant={tone} role={tone === 'danger' ? 'alert' : 'status'} className="p-3">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/* -------------------------------------------------------------------------- */
/* ConfirmDialog                                                              */
/* -------------------------------------------------------------------------- */

/** The look every modal of the app has; the size is the widest its content may be. */
function dialogClass(size: 'md' | 'lg'): string {
  return cn(
    'm-auto max-h-dialog-max w-[calc(100%-2rem)] overflow-y-auto rounded-token border border-border bg-surface p-6 text-start text-copy backdrop:bg-copy/50',
    size === 'lg' ? 'max-w-lg' : 'max-w-md',
  );
}

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string | undefined;
  /** The action that goes ahead. */
  readonly confirmLabel: string;
  /** `destructive` (the default) when it gives something up; `default` when it only goes ahead. */
  readonly confirmVariant?: 'destructive' | 'default';
  /** What the question needs beside its words: a list of what will happen, a field for a note. */
  readonly children?: ReactNode;
  /** Both answers, Escape included, are out of reach while the confirmed action runs. */
  readonly isPending?: boolean;
  /** The way ahead is not open yet (a choice is missing); the way back always is. */
  readonly isConfirmDisabled?: boolean;
  readonly size?: 'md' | 'lg';
  /** The way back. It holds the initial focus, so a stray Enter keeps the visitor's work. */
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * A modal question with two answers, on the platform's `<dialog>`: it traps
 * focus, makes the page behind it inert, closes on Escape (which answers
 * "cancel") and hands focus back to what had it before. Nothing closes it
 * while the confirmed action is pending, and tall content scrolls inside it.
 *
 * Never put a `display` utility (`flex`, `grid`) on the `<dialog>` itself: it
 * would override the closed state's `display: none`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'destructive',
  children,
  isPending = false,
  isConfirmDisabled = false,
  size = 'md',
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { dialog, setDialog, cancelRef, handlers } = useModalDialog({ open, isPending, onCancel });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={setDialog}
      role={confirmVariant === 'destructive' ? 'alertdialog' : 'dialog'}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-busy={isPending}
      {...handlers}
      className={dialogClass(size)}
    >
      <h2
        id={titleId}
        className="font-heading text-lg font-semibold text-copy [overflow-wrap:anywhere]"
      >
        {title}
      </h2>
      {description !== undefined && (
        <p
          id={descriptionId}
          // Long file names and URLs wrap instead of pushing the dialog wider.
          className="mt-2 text-sm text-copy-muted [overflow-wrap:anywhere]"
        >
          {description}
        </p>
      )}
      {children !== undefined && (
        <PortalContainerContext value={dialog}>
          <div className="mt-4">{children}</div>
        </PortalContainerContext>
      )}
      <div
        className={cn(
          'mt-6 flex flex-wrap gap-2 border-t border-border pt-4',
          // The way back sits first when going ahead is the ordinary answer.
          confirmVariant === 'default' ? 'flex-row-reverse justify-start' : 'justify-end',
        )}
      >
        <Button
          type="button"
          variant={confirmVariant}
          disabled={isPending || isConfirmDisabled}
          onClick={onConfirm}
          className="h-auto min-h-8 max-w-full py-1 whitespace-normal [overflow-wrap:anywhere]"
        >
          {confirmLabel}
        </Button>
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
          className="h-auto min-h-8 max-w-full py-1 whitespace-normal [overflow-wrap:anywhere]"
        >
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* InfoDialog                                                                 */
/* -------------------------------------------------------------------------- */

interface InfoDialogProps {
  readonly open: boolean;
  readonly title: string;
  /** One quiet line under the title (when and where). */
  readonly description?: string | undefined;
  /** What the dialog shows, e.g. labelled facts. */
  readonly children: ReactNode;
  /** The actions on what is shown, at the foot beside "close". */
  readonly actions?: ReactNode;
  /** Above the title: a state chip or the like. */
  readonly status?: ReactNode;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly size?: 'md' | 'lg';
}

/**
 * A modal that shows one thing and what can be done with it (a booking's details), on the platform's
 * `<dialog>` like `ConfirmDialog`: focus is trapped, the page behind is inert, Escape closes it and
 * focus returns to what had it. Its actions sit in one row at the foot so they never crowd the facts.
 */
export function InfoDialog({
  open,
  title,
  description,
  children,
  actions,
  status,
  closeLabel,
  onClose,
  size = 'md',
}: InfoDialogProps) {
  const { dialog, setDialog, cancelRef, handlers } = useModalDialog({
    open,
    isPending: false,
    onCancel: onClose,
  });
  const titleId = useId();

  return (
    <dialog ref={setDialog} aria-labelledby={titleId} {...handlers} className={dialogClass(size)}>
      <header className="space-y-1">
        {status}
        <h2
          id={titleId}
          className="font-heading text-lg font-semibold text-copy [overflow-wrap:anywhere]"
        >
          {title}
        </h2>
        {description !== undefined && (
          <p className="text-sm text-copy-muted [overflow-wrap:anywhere]">{description}</p>
        )}
      </header>
      <PortalContainerContext value={dialog}>
        <div className="mt-4">{children}</div>
      </PortalContainerContext>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <PortalContainerContext value={dialog}>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </PortalContainerContext>
        <Button ref={cancelRef} type="button" variant="outline" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* DeleteWhenUnusedDialog                                                     */
/* -------------------------------------------------------------------------- */

/** One place that still shows what would be deleted, opening where it can be switched. */
export interface UnusedCheckUse {
  readonly href: string;
  /** What uses it: a component, or a page. */
  readonly label: string;
  /** Where that is, e.g. the page a component sits on. */
  readonly detail?: string | undefined;
}

/** The words of the dialog, already translated: what it says when something uses the thing, and what it offers. */
export type DeleteWhenUnusedLabels = Readonly<
  Record<
    | 'inUseTitle'
    | 'inUseDescription'
    | 'liveDescription'
    | 'unknownDescription'
    | 'openFirst'
    | 'openLive'
    | 'close',
    string
  >
>;

interface DeleteWhenUnusedDialogProps {
  readonly open: boolean;
  /** Drafts still using it; `null` when that is unknown. */
  readonly uses: readonly UnusedCheckUse[] | null;
  /** Where the live usage is resolved (publishing); set only when the live site still uses it. */
  readonly liveHref?: string | undefined;
  /** The ordinary question, asked when nothing uses it. */
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly labels: DeleteWhenUnusedLabels;
  readonly isPending: boolean;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

/**
 * Deleting, or saying why not yet. What a page still shows is not deleted: the dialog lists each
 * use with a link to where it is switched, and the first is one click away. Only when nothing
 * uses it does it ask the ordinary question.
 */
export function DeleteWhenUnusedDialog({
  open,
  uses,
  liveHref,
  title,
  description,
  confirmLabel,
  labels,
  isPending,
  onDelete,
  onClose,
}: DeleteWhenUnusedDialogProps) {
  const router = useRouter();
  const next = uses?.[0]?.href ?? liveHref;

  const way = { open, cancelLabel: labels.close, onCancel: onClose };

  if (next === undefined) {
    return (
      <ConfirmDialog
        {...way}
        title={title}
        description={uses === null ? labels.unknownDescription : description}
        confirmLabel={confirmLabel}
        isPending={isPending}
        onConfirm={onDelete}
      />
    );
  }

  const hasUses = uses !== null && uses.length > 0;
  return (
    <ConfirmDialog
      {...way}
      size="lg"
      confirmVariant="default"
      title={labels.inUseTitle}
      description={hasUses ? labels.inUseDescription : labels.liveDescription}
      confirmLabel={hasUses ? labels.openFirst : labels.openLive}
      onConfirm={() => {
        onClose();
        router.push(next);
      }}
    >
      {hasUses && (
        <ul className="divide-y divide-border rounded-token border border-border">
          {uses.map((use) => (
            <li key={use.href}>
              <Link
                href={use.href}
                onClick={onClose}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none focus-visible:ring-inset"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-copy">{use.label}</span>
                  {use.detail !== undefined && (
                    <span className="ml-2 text-xs text-copy-muted">{use.detail}</span>
                  )}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-copy-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}

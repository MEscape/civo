import { useId } from 'react';
import type { ReactNode } from 'react';

import { AlertTriangle, ArrowRight } from '@components/icons/icons';
import { FieldMessage, FieldSuccess } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface DataPanelProps {
  readonly title: string;
  readonly description?: string | undefined;
  /** A quiet fact about the whole list beside the title's opposite edge: its count. */
  readonly meta?: ReactNode;
  /** Controls that act on the whole panel: a refresh, the one main action. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  /** A quiet strip under the content: a count, a hint, the pagination. */
  readonly footer?: ReactNode;
  readonly className?: string | undefined;
}

/**
 * The frame of a list or table that is the subject of a screen: a `Card`
 * with a tinted header strip (the title and what acts on the whole list), the
 * rows, and an optional footer. Lists of one screen look alike because they
 * share it. A labelled region, so assistive technology can jump to it.
 */
export function DataPanel({
  title,
  description,
  meta,
  actions,
  children,
  footer,
  className,
}: DataPanelProps) {
  const headingId = useId();
  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      // `min-w-0` lets the panel shrink inside a grid or flex parent, so a wide
      // table scrolls in its own container instead of stretching the page.
      className={cn('min-w-0 overflow-hidden', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2 id={headingId} className="font-heading text-sm font-semibold text-copy">
            {title}
          </h2>
          {description !== undefined && <p className="text-xs text-copy-muted">{description}</p>}
        </div>
        {(meta !== undefined || actions !== undefined) && (
          <div className="flex flex-wrap items-center gap-3">
            {meta !== undefined && <span className="text-xs text-copy-muted">{meta}</span>}
            {actions}
          </div>
        )}
      </div>
      {children}
      {footer !== undefined && (
        <div className="border-t border-border bg-canvas px-4 py-3 text-xs text-copy-muted">
          {footer}
        </div>
      )}
    </Card>
  );
}

/** The fields of a form inside a `DataPanel`, with the panel's inner spacing. */
export function DataPanelBody({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={cn('space-y-6 p-4 sm:p-6', className)}>{children}</div>;
}

export interface DataPanelFooterProps {
  /** Where the form stands (saved, unsaved, refused), read out as it changes. */
  readonly status?: ReactNode;
  /** The form's actions, the submit button last. */
  readonly children: ReactNode;
}

/**
 * The foot of a form inside a `DataPanel`: its state on the left, its actions
 * on the right, on the tinted strip panels use for their header and footer.
 * Every form in a panel ends the same way.
 */
export function DataPanelFooter({ status, children }: DataPanelFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-canvas px-4 py-3">
      <div role="status" className="mr-auto min-w-0 text-sm">
        {status}
      </div>
      {children}
    </div>
  );
}

export interface DataPanelSaveFooterProps {
  /** The form's id prefix, for the error message's id. */
  readonly id: string;
  readonly isPending: boolean;
  readonly isDirty: boolean;
  readonly showSaved: boolean;
  readonly savedLabel: string;
  readonly unsavedLabel: string;
  readonly submitLabel: string;
  /** The form-level refusal, translated; `undefined` while there is none. */
  readonly error?: string | undefined;
}

/**
 * The foot of an edit form in a panel (settings, profile, an editor): what state the form is in (unsaved, saved,
 * refused) on the left, the save button on the right. Saving is offered only
 * when there is something to save.
 */
export function DataPanelSaveFooter({
  id,
  isPending,
  isDirty,
  showSaved,
  savedLabel,
  unsavedLabel,
  submitLabel,
  error,
}: DataPanelSaveFooterProps) {
  return (
    <DataPanelFooter
      status={
        <>
          {error === undefined && showSaved && <FieldSuccess>{savedLabel}</FieldSuccess>}
          {error === undefined && isDirty && (
            <p className="flex items-center gap-2 text-copy-muted">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warning" />
              {unsavedLabel}
            </p>
          )}
          <FieldMessage id={`${id}-form-error`} message={error} className="text-sm" />
        </>
      }
    >
      <Button type="submit" disabled={isPending || !isDirty}>
        {submitLabel}
      </Button>
    </DataPanelFooter>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview blocks                                                            */
/* -------------------------------------------------------------------------- */

export interface OverviewPanelProps {
  readonly title: string;
  /** Where the whole subject lives; omitted when the actor may not go there. */
  readonly link?: { readonly href: string; readonly label: string };
  /** A quiet fact about the whole block beside the link: its count. */
  readonly meta?: ReactNode;
  readonly children: ReactNode;
  /** `h-full` makes the panel as tall as the row it sits in, its body taking the room. */
  readonly className?: string;
}

/**
 * One block of an overview page: the frame every panel of the admin shares
 * (`DataPanel`), with an optional way to the subject's own page, and the
 * facts as rows. Blocks hold information, not forms, so a page of them reads
 * at a glance.
 */
export function OverviewPanel({ title, link, meta, children, className }: OverviewPanelProps) {
  return (
    <DataPanel
      title={title}
      meta={meta}
      className={cn('flex flex-col', className)}
      actions={
        link !== undefined && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 rounded-token-sm text-xs font-medium text-copy-muted outline-none hover:text-copy focus-visible:ring-2 focus-visible:ring-focus"
          >
            {link.label}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )
      }
    >
      <div className="flex flex-1 flex-col divide-y divide-border">{children}</div>
    </DataPanel>
  );
}

/** One row of an `OverviewPanel`: a label above or beside its value. */
export function OverviewRow({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={cn('px-4 py-3', className)}>{children}</div>;
}

/** Key figures of an `OverviewPanel`, side by side. */
export function OverviewStats({ children }: { readonly children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-4">{children}</dl>;
}

export interface OverviewStatProps {
  readonly label: string;
  /** The formatted figure. */
  readonly value: string;
  /** A figure that asks for attention (warnings) is tinted and marked, so colour is not the only signal. */
  readonly tone?: 'default' | 'warning';
}

/** One key figure: a small label over a large number. */
export function OverviewStat({ label, value, tone = 'default' }: OverviewStatProps) {
  const isWarning = tone === 'warning';
  return (
    <div>
      <dt className="text-xs font-medium text-copy-muted">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 flex items-center gap-1.5 font-heading text-2xl font-semibold',
          isWarning ? 'text-warning' : 'text-copy',
        )}
      >
        {isWarning && <AlertTriangle className="size-5" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  );
}

export interface OverviewTileProps {
  /** What is counted. */
  readonly label: string;
  /** The formatted headline figure. */
  readonly value: string;
  /** One line of supporting facts under the figure. */
  readonly detail?: string | undefined;
  /** A line that asks for something (a missing step), under the facts. */
  readonly hint?: string | undefined;
  /** Where the whole subject lives: the tile is the link. Without one the tile is only a figure (nothing to open yet). */
  readonly href?: string | undefined;
  /** A figure that asks for attention is tinted and marked, so colour is not the only signal. */
  readonly tone?: 'default' | 'warning';
}

/**
 * One subject of an overview in the least room that still says something: its figure, a line of
 * facts and the way in. Tiles sit side by side so the whole website reads at one glance.
 */
export function OverviewTile({
  label,
  value,
  detail,
  hint,
  href,
  tone = 'default',
}: OverviewTileProps) {
  const isWarning = tone === 'warning';
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-copy-muted">
        {label}
        {href !== undefined && (
          <ArrowRight
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            aria-hidden="true"
          />
        )}
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 font-heading text-2xl font-semibold',
          isWarning ? 'text-warning' : 'text-copy',
        )}
      >
        {isWarning && <AlertTriangle className="size-5" aria-hidden="true" />}
        {value}
      </span>
      {detail !== undefined && detail !== '' && (
        <span className="line-clamp-2 text-xs text-copy-muted">{detail}</span>
      )}
      {hint !== undefined && hint !== '' && (
        <span className="line-clamp-2 text-xs text-copy">{hint}</span>
      )}
    </>
  );
  const frame =
    'group flex h-full flex-col gap-0.5 rounded-token border border-border bg-surface p-4 shadow-sm';
  if (href === undefined) {
    return <div className={frame}>{body}</div>;
  }
  return (
    <Link
      href={href}
      className={cn(
        frame,
        'outline-none transition-colors hover:bg-canvas focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none',
      )}
    >
      {body}
    </Link>
  );
}

/** The tiles of an overview in one responsive row-wrapping grid. */
export function OverviewTiles({ children }: { readonly children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{children}</div>;
}

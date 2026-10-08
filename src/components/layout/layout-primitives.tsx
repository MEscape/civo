import type { HTMLAttributes } from 'react';

import { cn } from '@lib/utils';

/**
 * Full-viewport page shell. Composes the app header + scrollable body.
 *
 * Tokens used: `bg-canvas` (page background), `h-full` (full height chain
 * starting from the `<html>` element set in the root layout).
 */
export function PageShell({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex h-full flex-col bg-canvas', className)} {...props} />;
}

/**
 * Fixed-height top bar. Height is driven by `--civo-app-header-height` via
 * the `h-app-header` spacing token — never hard-coded.
 *
 * Semantics: use `<header>` so screen-readers announce it as a landmark.
 */
export function AppHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-[var(--civo-app-header-height)] shrink-0 items-center',
        'border-b border-border bg-surface px-4',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Scrollable body below the app header.
 * Uses the `h-app-body` utility defined in globals.css (dvh-aware).
 */
export function AppBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)} {...props} />
  );
}

/**
 * Centered, width-capped content column.
 *
 * `max-w-7xl` keeps line-lengths readable on wide screens while leaving room
 * for sidebar layouts. Override via `className` when a narrower prose column
 * is needed (e.g. `max-w-2xl`).
 */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)} {...props} />
  );
}

const SECTION_TONE_CLASSES = {
  default: '',
  muted: 'bg-surface',
} as const;

/** Background of a page section: the canvas, or the raised surface that sets a section apart from its neighbours. */
export type SectionTone = keyof typeof SECTION_TONE_CLASSES;

/** The background class of a section tone, for wrappers that group sections without being one. */
export function sectionToneClass(tone: SectionTone): string {
  return SECTION_TONE_CLASSES[tone];
}

interface SectionProps extends HTMLAttributes<HTMLElement> {
  tone?: SectionTone;
}

/**
 * Vertical section block with the standard section spacing token.
 * Use for major content sections on marketing/content pages.
 */
export function Section({ tone = 'default', className, ...props }: SectionProps) {
  return <section className={cn('py-section', sectionToneClass(tone), className)} {...props} />;
}

/**
 * Two-pane layout: fixed-width sidebar on the left, fluid main on the right.
 * Used for the builder workspace and settings pages.
 *
 * The sidebar width is intentionally a scale utility (w-64) so it snaps to a
 * design-system multiple. Override via `sidebarClassName` if a different
 * width is needed — but always use a Tailwind scale utility, never an arbitrary px value.
 */
interface SidebarLayoutProps extends HTMLAttributes<HTMLDivElement> {
  sidebar: React.ReactNode;
  sidebarClassName?: string;
}

export function SidebarLayout({
  sidebar,
  sidebarClassName,
  className,
  children,
  ...props
}: SidebarLayoutProps) {
  return (
    <div className={cn('flex h-app-body overflow-hidden', className)} {...props}>
      <aside
        className={cn(
          'flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface',
          sidebarClassName,
        )}
      >
        {sidebar}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}

/**
 * Page-level heading group. Contains the `<h1>` + optional lead text.
 * One `<h1>` per page — enforced by this component existing as the canonical
 * wrapper so teams do not scatter raw `<h1>` elements.
 */
interface PageHeadingProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string | undefined;
}

export function PageHeading({ title, description, className, ...props }: PageHeadingProps) {
  return (
    <div className={cn('space-y-1', className)} {...props}>
      <h1 className="font-heading text-2xl font-semibold text-copy">{title}</h1>
      {description ? <p className="text-sm text-copy-muted">{description}</p> : null}
    </div>
  );
}

/**
 * Horizontal rule using the design-system border token.
 * Thin wrapper so `<hr>` always uses `border-border`, never a raw color.
 */
export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-t border-border', className)} {...props} />;
}

const EMPTY_STATE_VARIANTS = {
  plain: '',
  /** Inside a panel or list: a dashed outline marks where content will appear. */
  outlined: 'rounded-token border border-dashed border-border',
} as const;

/**
 * Empty-state placeholder. Centered, muted, with optional icon slot.
 */
interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: keyof typeof EMPTY_STATE_VARIANTS;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = 'plain',
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 text-center',
        EMPTY_STATE_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon ? <span className="text-copy-muted">{icon}</span> : null}
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold text-copy">{title}</p>
        {description ? <p className="max-w-sm text-sm text-copy-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Heading of a content section on a public or canvas page. An `h2`: the
 * page's single `h1` is `PageHeading`.
 */
export function SectionHeading({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('mb-6 font-heading text-2xl font-semibold text-copy', className)} {...props}>
      {children}
    </h2>
  );
}

const GRID_COLUMN_CLASSES = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 @xl:grid-cols-2',
  3: 'grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3',
  4: 'grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-4',
} as const;

export type GridColumns = keyof typeof GRID_COLUMN_CLASSES;

interface GridProps extends HTMLAttributes<HTMLElement> {
  columns: GridColumns;
  /** `ul`/`ol` when the children are `li` items of a list. */
  as?: 'div' | 'ul' | 'ol';
}

/**
 * Responsive card grid. It reacts to the width of its own container, not of
 * the window, so it lays out correctly inside the builder canvas where side
 * panels take away from the viewport.
 */
export function Grid({ columns, as: Element = 'div', className, ...props }: GridProps) {
  return (
    <div className="@container">
      <Element className={cn('grid gap-4', GRID_COLUMN_CLASSES[columns], className)} {...props} />
    </div>
  );
}

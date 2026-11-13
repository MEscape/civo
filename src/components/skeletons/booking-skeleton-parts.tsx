import type { ReactNode } from 'react';

import { AdminContainer, Section } from '@components/layout/layout-primitives';
import { LoadingStatus } from '@components/shared/page-parts.client';
import type { Density } from '@components/shared/responsive-table';
import { Skeleton } from '@components/ui/skeleton';

import { cn } from '@lib/utils';

import { ResponsiveTableSkeleton } from './responsive-table-skeleton';

export const PANEL = 'overflow-hidden rounded-token border border-border bg-surface shadow-sm';
const PANEL_HEADER =
  'flex items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-3';

/**
 * The frame every booking screen has, in the rhythm of `AdminPage` (one column, `space-y-6`), so
 * nothing jumps when the screen arrives: optional trail, the heading with its lead and main action,
 * then the screen's own blocks. The workspace bar above belongs to the layout and is not drawn here.
 */
export function ScreenSkeleton({
  hasCrumbs = false,
  hasDescription = true,
  actions = 0,
  hasScope = false,
  children,
}: {
  readonly hasCrumbs?: boolean;
  /** The line of text under the title; a few pages (a location, a new location or service) have none. */
  readonly hasDescription?: boolean;
  /**
   * How many buttons the heading has at its far edge. Only an action every viewer has in every state is
   * drawn (the buttons of the team member and of a location); one that depends on the viewer's rights or
   * on the data (a "New …" button, "Mark all read") appears with the screen and moves nothing.
   */
  readonly actions?: number;
  /** The "Working at [location]" row a list of one location has under its heading. */
  readonly hasScope?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <AdminContainer aria-busy="true">
      <Section className="space-y-6 py-8">
        <LoadingStatus />
        <div aria-hidden="true" className="space-y-3">
          {hasCrumbs && <Skeleton className="h-5 w-56 max-w-full" />}
          <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="space-y-1">
                <Skeleton className="h-8 w-56 max-w-full" />
                {hasDescription && <Skeleton className="h-5 w-2/3 max-w-md" />}
              </div>
              {hasScope && (
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-7.5 w-44 max-w-full" />
                </div>
              )}
            </div>
            {actions > 0 && (
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {Array.from({ length: actions }, (_, action) => (
                  <Skeleton key={action} className="h-8 w-28" />
                ))}
              </div>
            )}
          </div>
        </div>
        {children}
      </Section>
    </AdminContainer>
  );
}

/** A framed block with the tinted header strip every panel of the admin has. */
export function PanelSkeleton({
  className,
  children,
  hasDescription = false,
  hasMeta = true,
  meta,
}: {
  readonly className?: string;
  readonly children: ReactNode;
  readonly hasDescription?: boolean;
  readonly hasMeta?: boolean;
  /** What the header holds at its end in place of the count: a panel with controls (the calendar's period). */
  readonly meta?: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={cn(PANEL, className)}>
      <div className={PANEL_HEADER}>
        <div className="min-w-0 space-y-1">
          <Skeleton className="h-5 w-32 max-w-full" />
          {hasDescription && <Skeleton className="h-4 w-56 max-w-full" />}
        </div>
        {meta ?? (hasMeta && <Skeleton className="h-4 w-20 shrink-0" />)}
      </div>
      {children}
    </div>
  );
}

/** The column heads and rows of a table inside a panel. */
export function TableSkeleton({
  rows,
  columns,
  density,
  titleColumn,
}: {
  readonly rows?: readonly string[];
  readonly columns?: number;
  readonly density?: Density;
  readonly titleColumn?: number | null;
}) {
  return (
    <ResponsiveTableSkeleton
      {...(rows === undefined ? {} : { rows })}
      {...(columns === undefined ? {} : { columns })}
      {...(density === undefined ? {} : { density })}
      {...(titleColumn === undefined ? {} : { titleColumn })}
    />
  );
}

const TILES = ['a', 'b', 'c', 'd'] as const;

/** The four figures the overview and the employee's start open with: a label, the figure, and what it counts. */
export function TilesSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILES.map((tile) => (
        <div key={tile} className="space-y-2 rounded-token border border-border bg-surface p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-10" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** The note a page opens with (the hint of the open bookings, of the preferences), as the info alert draws it. */
export function AlertSkeleton() {
  return <Skeleton aria-hidden="true" className="h-12 w-full" />;
}

/**
 * The filter strip of a list, as the lists draw it: the quick filters (chips) as a section of their
 * own, then the search and the selects with their button as another.
 */
export function FiltersSkeleton({
  hasChips = true,
  chips = 3,
  selects = 1,
}: {
  readonly hasChips?: boolean;
  readonly chips?: number;
  readonly selects?: number;
}) {
  return (
    <div aria-hidden="true" className="divide-y divide-border border-b border-border">
      {hasChips && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
          {Array.from({ length: chips }, (_, chip) => (
            <Skeleton key={chip} className="h-7 w-24 max-w-full" />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <Skeleton className="h-9 min-w-[min(14rem,100%)] flex-1" />
        {Array.from({ length: selects }, (_, select) => (
          <Skeleton key={select} className="h-9 w-36 max-w-full" />
        ))}
        <div className="flex gap-1">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}

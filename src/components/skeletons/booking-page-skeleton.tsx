import { Skeleton } from '@components/ui/skeleton';

import { cn } from '@lib/utils';

import {
  AlertSkeleton,
  FiltersSkeleton,
  PANEL,
  PanelSkeleton,
  ScreenSkeleton,
  TableSkeleton,
} from './booking-skeleton-parts';

const ROWS = ['a', 'b', 'c', 'd'] as const;
const LOCATION_ROWS = ['a', 'b', 'c'] as const;

const LIST_SHAPES = {
  bookings: { columns: 7, chips: 8, selects: 4, titleColumn: 1 },
  resources: { columns: 6, chips: 0, selects: 1, titleColumn: null },
  team: { columns: 6, chips: 2, selects: 1, titleColumn: 0 },
  open: { columns: 4, chips: 4, selects: 3, titleColumn: 1 },
  messages: { columns: 4, chips: 0, selects: 0, titleColumn: 1 },
} as const;

/**
 * A list screen (bookings, services, resources, the team, the employee's lists): the heading, and one
 * panel with its filters (where the list has them) and rows. The Suspense fallback of the booking lists and the segment's
 * `loading.tsx`.
 */
export function BookingPageSkeleton({
  hasFilters = true,
  hasAlert = false,
  isScoped = false,
  variant = 'bookings',
}: {
  readonly hasFilters?: boolean;
  /** The note above the panel (the open bookings say what they are). */
  readonly hasAlert?: boolean;
  /** A list of one location (services, resources, the team): the trail and "Working at …" under the heading. */
  readonly isScoped?: boolean;
  readonly variant?: keyof typeof LIST_SHAPES;
}) {
  const shape = LIST_SHAPES[variant];
  return (
    <ScreenSkeleton hasCrumbs={isScoped} hasScope={isScoped}>
      {hasAlert && <AlertSkeleton />}
      <PanelSkeleton>
        {hasFilters && (
          <FiltersSkeleton hasChips={shape.chips > 0} chips={shape.chips} selects={shape.selects} />
        )}
        <TableSkeleton columns={shape.columns} titleColumn={shape.titleColumn} />
      </PanelSkeleton>
    </ScreenSkeleton>
  );
}

const CATEGORIES = ['a', 'b', 'c'] as const;

/**
 * The services of a location: the heading with its location row, and one panel with its filters, the
 * button that opens every category, and the categories as collapsed rows (the first ones open on a few
 * rows).
 */
export function BookingServicesSkeleton() {
  return (
    <ScreenSkeleton hasCrumbs hasScope>
      <PanelSkeleton>
        <FiltersSkeleton selects={2} />
        <div aria-hidden="true" className="flex justify-end border-b border-border px-4 py-2">
          <Skeleton className="h-8 w-24" />
        </div>
        {CATEGORIES.map((category, index) => (
          <div key={category} className="border-b border-border last:border-b-0">
            <div className="flex items-center justify-between gap-3 bg-canvas px-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            {index < 2 && <TableSkeleton rows={['a', 'b']} columns={5} />}
          </div>
        ))}
      </PanelSkeleton>
    </ScreenSkeleton>
  );
}

/**
 * One location, service or resource: the trail, the heading with its actions, and the rows of its
 * parts; a location has its map beside them.
 */
export function BookingDetailSkeleton({
  hasMap = false,
  isResource = false,
  hasDescription = true,
  actions = 0,
}: {
  readonly hasMap?: boolean;
  /** A location's heading has no line of text under its name. */
  readonly hasDescription?: boolean;
  readonly isResource?: boolean;
  /** The buttons every viewer has beside the heading (a location's services and resources). */
  readonly actions?: number;
}) {
  return (
    <ScreenSkeleton hasCrumbs hasDescription={hasDescription} actions={actions}>
      <div aria-hidden="true" className="flex flex-wrap gap-2">
        <Skeleton className="h-5.5 w-24" />
        <Skeleton className="h-5.5 w-32" />
      </div>
      <div className={cn('grid gap-6', hasMap && 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
        <div aria-hidden="true" className={PANEL}>
          <div className="divide-y divide-border">
            {(hasMap || isResource ? LOCATION_ROWS : ROWS).map((row) => (
              <div
                key={row}
                className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-6">
                  <Skeleton className="h-4 w-40 max-w-full shrink-0" />
                  <Skeleton className="h-4 w-2/3 sm:flex-1" />
                </div>
                <Skeleton className="h-7 w-16 shrink-0 self-start sm:self-center" />
              </div>
            ))}
          </div>
        </div>
        {hasMap && <Skeleton aria-hidden="true" className="min-h-64" />}
      </div>
      {isResource && (
        <div aria-hidden="true" className={cn(PANEL, 'min-h-44')}>
          <div className="space-y-2 p-4">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      )}
    </ScreenSkeleton>
  );
}

/** Taking a service over: the list of services and, beside it, how it is taken. */
export function BookingAdoptSkeleton() {
  return (
    <ScreenSkeleton hasCrumbs>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PanelSkeleton>
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-40" />
          </div>
          <TableSkeleton />
        </PanelSkeleton>
        <PanelSkeleton>
          <div className="flex flex-col items-center gap-3 p-10">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </PanelSkeleton>
      </div>
    </ScreenSkeleton>
  );
}

/** The workspace entry screen: one framed list with two columns and the content's compact breakpoint. */
export function BookingCardsSkeleton() {
  return (
    <ScreenSkeleton>
      <PanelSkeleton hasMeta={false}>
        <TableSkeleton columns={2} density="compact" />
      </PanelSkeleton>
    </ScreenSkeleton>
  );
}

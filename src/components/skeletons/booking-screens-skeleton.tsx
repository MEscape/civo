import { Skeleton } from '@components/ui/skeleton';

import {
  FiltersSkeleton,
  PanelSkeleton,
  ScreenSkeleton,
  TableSkeleton,
  TilesSkeleton,
} from './booking-skeleton-parts';

const STATES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const DAYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
/** The heights of the chart's placeholder bars, as fractions of its height. */
const BAR_HEIGHTS = ['h-2/5', 'h-3/5', 'h-1/2', 'h-4/5', 'h-1/3', 'h-3/4', 'h-2/3'] as const;

/** The overview: figures, today beside the week's chart, and the table of locations. */
export function BookingOverviewSkeleton() {
  return (
    <ScreenSkeleton>
      <TilesSkeleton />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PanelSkeleton className="min-h-76">
          <div className="flex flex-col items-center gap-3 p-10">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </PanelSkeleton>
        <PanelSkeleton className="min-h-76">
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-16" />
            </div>
            <div className="flex h-32 items-end gap-2">
              {BAR_HEIGHTS.map((height) => (
                <Skeleton key={height} className={`flex-1 ${height}`} />
              ))}
            </div>
          </div>
        </PanelSkeleton>
      </div>
      <PanelSkeleton>
        <TableSkeleton rows={['a', 'b']} columns={4} />
      </PanelSkeleton>
    </ScreenSkeleton>
  );
}

/** The calendar: one panel, its period and controls in the header, the state chips, and the grid of days under a column of hours. */
export function BookingCalendarSkeleton() {
  return (
    <ScreenSkeleton>
      <PanelSkeleton meta={<Skeleton className="h-9 w-56" />}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {STATES.map((state) => (
            <Skeleton key={state} aria-hidden="true" className="h-7 w-16" />
          ))}
        </div>
        <div aria-hidden="true" className="flex gap-px p-4">
          <Skeleton className="h-96 w-10 shrink-0 rounded-none" />
          <div className="grid flex-1 grid-cols-7 gap-px">
            {DAYS.map((day) => (
              <Skeleton key={day} className="h-96 rounded-none" />
            ))}
          </div>
        </div>
      </PanelSkeleton>
    </ScreenSkeleton>
  );
}

/** The locations: the table and, beside it from a wide screen on, the map. */
export function BookingLocationsSkeleton() {
  return (
    <ScreenSkeleton>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PanelSkeleton>
          <FiltersSkeleton selects={0} />
          <TableSkeleton columns={4} />
          <div className="border-t border-border bg-canvas px-4 py-3">
            <Skeleton className="h-4 w-full max-w-prose" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2 sm:hidden" />
          </div>
        </PanelSkeleton>
        <Skeleton aria-hidden="true" className="h-80 lg:h-full lg:min-h-96" />
      </div>
    </ScreenSkeleton>
  );
}

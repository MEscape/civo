import { Skeleton } from '@components/ui/skeleton';

import { PanelSkeleton, ScreenSkeleton } from './booking-skeleton-parts';

const LOCATIONS = ['a', 'b', 'c'] as const;

/** Location-scoped areas open with a single panel of places and their entry actions. */
export function BookingAreaSkeleton() {
  return (
    <ScreenSkeleton>
      <PanelSkeleton hasDescription hasMeta={false}>
        <div className="divide-y divide-border">
          {LOCATIONS.map((location) => (
            <div key={location} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <Skeleton className="h-7 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </PanelSkeleton>
    </ScreenSkeleton>
  );
}

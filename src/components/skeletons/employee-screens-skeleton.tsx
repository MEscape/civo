import { Skeleton } from '@components/ui/skeleton';

import { cn } from '@lib/utils';

import {
  AlertSkeleton,
  PanelSkeleton,
  ScreenSkeleton,
  TableSkeleton,
  TilesSkeleton,
} from './booking-skeleton-parts';

const ROW_PLACEHOLDERS = ['a', 'b', 'c'] as const;

/** The employee's start: the figures, today's table beside the ways on and the news. The banner for an appointment that is near is not drawn: there is one only some of the time. */
export function BookingStartSkeleton() {
  return (
    <ScreenSkeleton>
      <TilesSkeleton />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <PanelSkeleton className="h-full">
          <TableSkeleton rows={ROW_PLACEHOLDERS} />
        </PanelSkeleton>
        <div className="space-y-6">
          <PanelSkeleton>
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </PanelSkeleton>
          <PanelSkeleton>
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </PanelSkeleton>
        </div>
      </div>
    </ScreenSkeleton>
  );
}

/** The day plan: the day's table with its controls in the header and the date field, beside the progress, the working day and the tips; the table is as tall as that column. */
export function BookingPlanSkeleton() {
  return (
    <ScreenSkeleton>
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PanelSkeleton className="h-full">
          <div aria-hidden="true" className="flex items-end gap-3 border-b border-border px-4 py-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-16" />
          </div>
          <TableSkeleton rows={ROW_PLACEHOLDERS} />
        </PanelSkeleton>
        <div className="space-y-6">
          <PanelSkeleton>
            <div className="space-y-3 p-4">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </PanelSkeleton>
          <PanelSkeleton>
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </PanelSkeleton>
          <PanelSkeleton>
            <div className="space-y-3 p-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </PanelSkeleton>
        </div>
      </div>
    </ScreenSkeleton>
  );
}

/** The preferences: the services beside the time window, and one footer to save them. */
export function BookingPreferencesSkeleton() {
  return (
    <ScreenSkeleton>
      <AlertSkeleton />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PanelSkeleton hasDescription hasMeta={false}>
          <div className="space-y-3 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        </PanelSkeleton>
        <PanelSkeleton hasDescription hasMeta={false}>
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-40" />
          </div>
        </PanelSkeleton>
      </div>
      <div
        aria-hidden="true"
        className="flex justify-end gap-3 rounded-token border border-border bg-canvas px-4 py-3"
      >
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-36" />
      </div>
    </ScreenSkeleton>
  );
}

/**
 * An employee's calendar, the same for the employee and for the manager who opens it: the panel about
 * the person (what is read only for them; the qualifications for a manager), the wide week editor, the
 * absences, the cover (a manager's only), and one footer to save. A manager has the trail above the
 * heading and the two buttons that put the person in a team.
 */
export function BookingProfileSkeleton({
  isManager = false,
}: {
  /** A manager opening an employee: the trail, the buttons, and the panel for cover at another location. */
  readonly isManager?: boolean;
}) {
  return (
    <ScreenSkeleton hasCrumbs={isManager} actions={isManager ? 2 : 0}>
      <PanelSkeleton className={cn(isManager && 'min-h-42')}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </PanelSkeleton>
      <PanelSkeleton>
        <div className="space-y-4 p-4">
          <Skeleton className="h-9 w-full max-w-80" />
          <Skeleton className="h-156 w-full" />
        </div>
      </PanelSkeleton>
      <PanelSkeleton>
        <div className="space-y-3 p-4">
          <Skeleton className="ms-auto h-9 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PanelSkeleton>
      {isManager && (
        <PanelSkeleton>
          <div className="space-y-3 p-4">
            <Skeleton className="ms-auto h-9 w-32" />
            <Skeleton className="h-36 w-full" />
          </div>
        </PanelSkeleton>
      )}
      <div
        aria-hidden="true"
        className="flex justify-end gap-3 rounded-token border border-border bg-canvas px-4 py-3"
      >
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </ScreenSkeleton>
  );
}

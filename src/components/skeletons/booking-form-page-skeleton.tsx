import { Skeleton } from '@components/ui/skeleton';

import { cn } from '@lib/utils';

import { PANEL, ScreenSkeleton } from './booking-skeleton-parts';

const FIELDS = ['a', 'b', 'c', 'd'] as const;
const STEPS = ['a', 'b', 'c', 'd', 'e'] as const;

/**
 * A booking form: the trail, the heading, the steps of the wizard (`steps`: five for a location or a
 * service, three for a resource) and the framed fields in the two columns the forms have, like
 * `Wizard`. Opened on one part (an edit) there are no steps (`steps` 0): one titled panel.
 */
export function BookingFormPageSkeleton({
  steps = 5,
  hasDescription = true,
}: {
  readonly steps?: number;
  /** Making a new location or service has no line of text under its heading. */
  readonly hasDescription?: boolean;
}) {
  const marks = STEPS.slice(0, steps);
  return (
    <ScreenSkeleton hasCrumbs hasDescription={hasDescription}>
      <div aria-hidden="true" className="space-y-6">
        {steps > 0 && (
          <div className="@container">
            <div className="flex items-center">
              {marks.map((step, index) => (
                <div
                  key={step}
                  className="flex min-w-0 flex-1 items-center gap-2 after:mx-2 after:h-0.5 after:flex-1 after:bg-border last:flex-none last:after:hidden"
                >
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <Skeleton className={cn('h-4 min-w-0 w-20', index > 0 && 'hidden @2xl:block')} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={PANEL}>
          <div className="space-y-3 border-b border-border bg-canvas px-4 py-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              {steps > 0 && <Skeleton className="h-4 w-20" />}
            </div>
            {steps > 0 && <Skeleton className="h-1 w-full" />}
          </div>
          <div className="grid gap-x-8 gap-y-6 p-4 sm:p-6 lg:grid-cols-2">
            {[0, 1].map((column) => (
              <div key={column} className="space-y-6">
                <Skeleton className="h-4 w-28" />
                {FIELDS.map((field) => (
                  <div key={field} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 border-t border-border bg-canvas px-4 py-3">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>
    </ScreenSkeleton>
  );
}

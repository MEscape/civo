import { AdminContainer, Section } from '@components/layout/layout-primitives';
import { Skeleton } from '@components/ui/skeleton';

import { LoadingStatus } from './loading-status';

const ROWS = ['a', 'b', 'c', 'd', 'e'] as const;

/** A list row: a two-line name on the left, a badge and an action on the right. */
function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="hidden h-6 w-20 sm:block" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

/**
 * The placeholder of an admin page while its data streams in, in the shape of
 * the usual page: a heading, then a framed panel (title strip, filter strip,
 * rows) like `DataPanel`. Cache Components needs a real placeholder at every
 * dynamic boundary (an empty `null` counts as none), and one that looks like
 * what follows keeps navigation feeling instant and the page from jumping.
 */
export function PageSkeleton() {
  return (
    <AdminContainer aria-busy="true">
      <Section className="space-y-6 py-8">
        <LoadingStatus />
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div
          className="overflow-hidden rounded-token border border-border bg-surface shadow-sm"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex flex-wrap gap-3 border-b border-border px-4 py-3">
            <Skeleton className="h-9 w-full sm:w-64" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="divide-y divide-border">
            {ROWS.map((row) => (
              <RowSkeleton key={row} />
            ))}
          </div>
        </div>
      </Section>
    </AdminContainer>
  );
}

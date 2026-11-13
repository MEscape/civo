import { AdminPageSkeleton, DataPanelSkeleton } from '@components/skeletons/admin-skeletons';
import { Skeleton } from '@components/ui/skeleton';

/** The two address-backed tabs of the release screen. */
function ReleaseTabsSkeleton() {
  return (
    <div className="flex gap-6 border-b border-border pb-3">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-32" />
    </div>
  );
}

/** The framed history, like `ReleaseHistoryTable`. */
export function ReleaseHistorySkeleton() {
  return (
    <div aria-hidden="true">
      <DataPanelSkeleton />
    </div>
  );
}

/** The component updates tab: the three steps, the state panel and the history of earlier updates. */
export function ReleaseUpdatesSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <DataPanelSkeleton rows={3} />
      <DataPanelSkeleton rows={3} />
    </div>
  );
}

/**
 * The placeholder of the release screen while its data streams in: the heading, the two tabs
 * and the framed history, like `ReleaseAdministration`. It is the route's `loading.tsx` and
 * the Suspense fallback of the page.
 */
export function ReleasesPageSkeleton() {
  return (
    <AdminPageSkeleton>
      <ReleaseTabsSkeleton />
      <DataPanelSkeleton />
    </AdminPageSkeleton>
  );
}

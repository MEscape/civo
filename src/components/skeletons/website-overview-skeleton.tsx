import { LoadingStatus } from '@components/shared/page-parts.client';
import { AdminPageSkeleton } from '@components/skeletons/admin-skeletons';
import { Skeleton } from '@components/ui/skeleton';

const TILES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

/** Each block of the overview streams in on its own, so a slow read never holds back the others. */
export function OverviewBlockSkeleton({
  variant = 'panel',
}: {
  readonly variant?: 'panel' | 'banner';
}) {
  if (variant === 'banner') {
    return (
      <div aria-busy="true" className="rounded-token border border-border bg-surface p-4">
        <LoadingStatus />
        <div className="flex flex-wrap items-center justify-between gap-4" aria-hidden="true">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      className="overflow-hidden rounded-token border border-border bg-surface shadow-sm"
    >
      <LoadingStatus />
      <div className="border-b border-border bg-canvas px-4 py-3">
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="space-y-3 px-4 py-4" aria-hidden="true">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/** One tile of the overview's figures. */
export function OverviewTileSkeleton() {
  return (
    <div aria-busy="true" className="space-y-2 rounded-token border border-border bg-surface p-4">
      <LoadingStatus />
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/**
 * The placeholder of a website's overview: the heading with its actions, the publication banner, the
 * row of figures and the activity, like `WebsiteOverview`. The route's `loading.tsx` and Suspense fallback.
 */
export function WebsiteOverviewSkeleton() {
  return (
    <AdminPageSkeleton hasAction>
      <OverviewBlockSkeleton variant="banner" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {TILES.map((tile) => (
          <OverviewTileSkeleton key={tile} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <OverviewBlockSkeleton />
        <OverviewBlockSkeleton />
      </div>
    </AdminPageSkeleton>
  );
}

import { AdminPageSkeleton } from '@components/skeletons/admin-skeletons';
import { Skeleton } from '@components/ui/skeleton';

/**
 * The placeholder of a release preview while it streams in: the heading with its breadcrumb and
 * the neighbouring releases, the page tabs and the frame that holds the frozen page. It is the
 * route's `loading.tsx` and the Suspense fallback of the page.
 */
export function ReleasePreviewSkeleton() {
  return (
    <AdminPageSkeleton hasCrumbs hasAction>
      <div className="space-y-4">
        <div className="flex gap-6 border-b border-border pb-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </AdminPageSkeleton>
  );
}

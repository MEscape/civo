import { LoadingStatus } from '@components/shared/loading-status';
import { Skeleton } from '@components/ui/skeleton';

/**
 * The placeholder of a sign-in style page while its data streams in: the
 * panel the pages use, with its round icon, heading and form. It is both the
 * route's `loading.tsx` and the Suspense fallback of every page that reads
 * request data (Cache Components needs a real placeholder at each boundary).
 * The shell around it is the layout's and is already on screen.
 */
export function AuthFormSkeleton() {
  return (
    <div
      aria-busy="true"
      className="overflow-hidden rounded-token border border-border bg-surface shadow-sm"
    >
      <LoadingStatus />
      <div aria-hidden="true" className="space-y-4 px-6 pt-8 sm:px-8">
        <Skeleton className="mx-auto size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="mx-auto h-8 w-2/3" />
          <Skeleton className="mx-auto h-4 w-5/6" />
        </div>
      </div>
      <div aria-hidden="true" className="space-y-5 px-6 py-6 sm:px-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
      <div aria-hidden="true" className="border-t border-border bg-canvas px-6 py-4 sm:px-8">
        <Skeleton className="mx-auto h-4 w-1/2 bg-surface" />
      </div>
    </div>
  );
}

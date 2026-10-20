import { LoadingStatus } from '@components/shared/loading-status';
import { Skeleton } from '@components/ui/skeleton';

/**
 * Placeholder for the page builder while editor session data streams in.
 * Preserves the exact 3-column shell geometry (`h-website-body`, toolbar,
 * palette, center canvas, properties panel) so navigation into the editor
 * feels immediate and does not incur cumulative layout shifts.
 */
export function BuilderSkeleton() {
  return (
    <div className="flex h-website-body flex-col" aria-busy="true">
      <LoadingStatus />
      <div
        className="flex h-app-header shrink-0 items-center justify-between border-b border-border bg-surface px-4"
        aria-hidden="true"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1" aria-hidden="true">
        <aside className="hidden w-60 shrink-0 space-y-4 border-r border-border bg-surface p-4 lg:block">
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-token" />
            <Skeleton className="h-16 rounded-token" />
            <Skeleton className="h-16 rounded-token" />
            <Skeleton className="h-16 rounded-token" />
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto bg-canvas p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            <Skeleton className="h-32 w-full rounded-token" />
            <Skeleton className="h-48 w-full rounded-token" />
          </div>
        </main>
        <aside className="hidden w-80 shrink-0 space-y-4 border-l border-border bg-surface p-4 lg:block">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </aside>
      </div>
    </div>
  );
}

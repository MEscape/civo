import { AdminPageSkeleton, WizardSkeleton } from '@components/skeletons/admin-skeletons';
import { Skeleton } from '@components/ui/skeleton';

const ROWS = ['a', 'b', 'c', 'd'] as const;

const PANEL = 'overflow-hidden rounded-token border border-border bg-surface shadow-sm';
const PANEL_HEADER =
  'flex items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-3';

/** A page: its sketch and title on the left, when it was saved in the middle, the way in on the right. */
function PageRowSkeleton() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-16 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex sm:justify-end">
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/**
 * The placeholder of the page list while it streams in: the heading with its create action and the
 * framed list with a sketch per page, like `BuilderPagesAdministration`. It is the route's
 * `loading.tsx` and the Suspense fallback of the page.
 */
export function BuilderPagesSkeleton() {
  return (
    <AdminPageSkeleton hasAction>
      <div className={PANEL}>
        <div className={PANEL_HEADER}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="divide-y divide-border">
          {ROWS.map((row) => (
            <PageRowSkeleton key={row} />
          ))}
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

/** Matches the "new page" wizard: breadcrumb, heading, two steps and the title and path fields. */
export function CreatePageSkeleton() {
  return (
    <AdminPageSkeleton hasCrumbs>
      <WizardSkeleton steps={2} fields={2} />
    </AdminPageSkeleton>
  );
}

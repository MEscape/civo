import { AdminPageSkeleton, WizardSkeleton } from '@components/skeletons/admin-skeletons';
import { Skeleton } from '@components/ui/skeleton';

/**
 * One map: breadcrumb and heading (with the delete action on a saved map's page), the four-step
 * wizard, and the preview beside it at a standard map's height.
 */
export function MapEditorSkeleton({ hasAction = false }: { readonly hasAction?: boolean }) {
  return (
    <AdminPageSkeleton hasCrumbs hasAction={hasAction}>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <WizardSkeleton steps={4} fields={2} />
        </div>
        <div className="min-w-0 space-y-4 rounded-token border border-border bg-surface p-4 shadow-sm">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-96 w-full rounded-token" />
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

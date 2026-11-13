import { AdminPageSkeleton, DataPanelSkeleton } from '@components/skeletons/admin-skeletons';

/**
 * The placeholder of the media screen while its files stream in: the heading with the upload
 * button and the framed, filterable list, like `MediaAdministration`. It is the route's
 * `loading.tsx` and the Suspense fallback of the page.
 */
export function MediaPageSkeleton() {
  return (
    <AdminPageSkeleton hasAction>
      <DataPanelSkeleton hasToolbar />
    </AdminPageSkeleton>
  );
}

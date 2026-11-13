import { AdminPageSkeleton, DataPanelSkeleton } from '@components/skeletons/admin-skeletons';

/** Mirrors the sources page: heading with its main action, then the list of sources. */
export function DataSourcesPageSkeleton() {
  return (
    <AdminPageSkeleton hasAction>
      <DataPanelSkeleton rows={3} />
    </AdminPageSkeleton>
  );
}

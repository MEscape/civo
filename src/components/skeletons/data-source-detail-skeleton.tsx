import { AdminPageSkeleton, DataPanelSkeleton } from '@components/skeletons/admin-skeletons';

/** Mirrors a source's page: breadcrumb, heading with its actions, the connection facts, the datasets. */
export function DataSourceDetailSkeleton() {
  return (
    <AdminPageSkeleton hasCrumbs hasAction>
      <DataPanelSkeleton rows={1} />
      <DataPanelSkeleton rows={3} />
    </AdminPageSkeleton>
  );
}

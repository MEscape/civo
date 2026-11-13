import { AdminPageSkeleton, DataPanelSkeleton } from '@components/skeletons/admin-skeletons';

/** The maps list: heading with its create action, then the list panel. */
export function MapsPageSkeleton() {
  return (
    <AdminPageSkeleton hasAction>
      <DataPanelSkeleton rows={3} />
    </AdminPageSkeleton>
  );
}

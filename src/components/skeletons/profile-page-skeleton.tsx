import { AdminPageSkeleton, FormPanelSkeleton } from '@components/skeletons/admin-skeletons';

/** The placeholder of `/profile`: breadcrumb, heading, the profile form beside the account panel. */
export function ProfilePageSkeleton() {
  return (
    <AdminPageSkeleton hasCrumbs>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FormPanelSkeleton fields={2} />
        <FormPanelSkeleton fields={3} />
      </div>
    </AdminPageSkeleton>
  );
}

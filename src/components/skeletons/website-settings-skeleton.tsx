import { AdminPageSkeleton, FormPanelSkeleton } from '@components/skeletons/admin-skeletons';
import { Skeleton } from '@components/ui/skeleton';

/** Keeps the settings heading, general form, theme form and live preview in place during loading. */
export function WebsiteSettingsSkeleton() {
  return (
    <AdminPageSkeleton>
      <FormPanelSkeleton fields={3} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FormPanelSkeleton fields={6} />
        <Skeleton className="h-80 w-full rounded-token" />
      </div>
    </AdminPageSkeleton>
  );
}

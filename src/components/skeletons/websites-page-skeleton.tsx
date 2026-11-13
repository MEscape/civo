import {
  AdminPageSkeleton,
  DataPanelSkeleton,
  WizardSkeleton,
} from '@components/skeletons/admin-skeletons';

/** Matches the website list: the heading and the framed rows. The create button is not drawn: only some people have it. */
export function WebsitesPageSkeleton() {
  return (
    <AdminPageSkeleton>
      <DataPanelSkeleton />
    </AdminPageSkeleton>
  );
}

/** Matches the "new website" wizard: breadcrumb, heading, three steps and the basics fields. */
export function CreateWebsiteSkeleton() {
  return (
    <AdminPageSkeleton hasCrumbs>
      <WizardSkeleton steps={3} fields={2} />
    </AdminPageSkeleton>
  );
}

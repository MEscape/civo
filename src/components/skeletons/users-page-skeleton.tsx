import {
  AdminPageSkeleton,
  DataPanelSkeleton,
  WizardSkeleton,
} from '@components/skeletons/admin-skeletons';

/**
 * The placeholder of the user management page, in either scope, while its data
 * streams in: the heading with the invite action, the people panel (title strip,
 * filter strip, rows) and the open invitations below it, like
 * `UsersAdministration`. It is the Suspense fallback of both user pages (Cache
 * Components needs a real placeholder at each dynamic boundary), and one that
 * looks like what follows keeps the page from jumping.
 */
export function UsersPageSkeleton() {
  return (
    <AdminPageSkeleton hasAction>
      <DataPanelSkeleton rows={5} hasToolbar />
      <DataPanelSkeleton rows={2} />
    </AdminPageSkeleton>
  );
}

/** The placeholder of the invite page: breadcrumb, heading and the three-step wizard. */
export function InviteUserPageSkeleton() {
  return (
    <AdminPageSkeleton hasCrumbs>
      <WizardSkeleton steps={3} fields={1} />
    </AdminPageSkeleton>
  );
}

import { AdminPageSkeleton, WizardSkeleton } from '@components/skeletons/admin-skeletons';

/**
 * Mirrors the data-source wizards (source, dataset, mapping): breadcrumb, heading, the step
 * indicator and the step's panel.
 */
export function DataSourceFormSkeleton({ steps = 3 }: { readonly steps?: number }) {
  return (
    <AdminPageSkeleton hasCrumbs>
      <WizardSkeleton steps={steps} />
    </AdminPageSkeleton>
  );
}

import { AdminPageSkeleton, DataPanelSkeleton } from '@components/skeletons/admin-skeletons';

/**
 * The placeholder of the audit page while its trail streams in: the heading, then the entries
 * panel with its filters and page links, like `AuditLog`.
 */
export function AuditPageSkeleton() {
  return (
    <AdminPageSkeleton>
      <DataPanelSkeleton rows={8} hasToolbar hasFooter />
    </AdminPageSkeleton>
  );
}

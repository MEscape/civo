import { RowListSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function MetricTableSkeleton() {
  return (
    <SectionSkeleton>
      <RowListSkeleton rows={6} />
    </SectionSkeleton>
  );
}

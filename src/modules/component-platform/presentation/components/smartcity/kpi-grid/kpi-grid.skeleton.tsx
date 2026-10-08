import { CardGridSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function KpiGridSkeleton() {
  return (
    <SectionSkeleton>
      <CardGridSkeleton columns={3} />
    </SectionSkeleton>
  );
}

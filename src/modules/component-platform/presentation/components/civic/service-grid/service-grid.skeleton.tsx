import { CardGridSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function ServiceGridSkeleton() {
  return (
    <SectionSkeleton tone="muted">
      <CardGridSkeleton columns={3} count={6} />
    </SectionSkeleton>
  );
}

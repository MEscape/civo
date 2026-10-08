import { CardGridSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function NewsGridSkeleton() {
  return (
    <SectionSkeleton>
      <CardGridSkeleton columns={3} withImage />
    </SectionSkeleton>
  );
}

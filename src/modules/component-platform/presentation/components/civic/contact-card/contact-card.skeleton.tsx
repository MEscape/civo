import { CardGridSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function ContactCardSkeleton() {
  return (
    <SectionSkeleton>
      <CardGridSkeleton columns={3} />
    </SectionSkeleton>
  );
}

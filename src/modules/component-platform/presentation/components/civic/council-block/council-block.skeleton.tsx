import { RowListSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function CouncilBlockSkeleton() {
  return (
    <SectionSkeleton>
      <RowListSkeleton rows={5} />
    </SectionSkeleton>
  );
}

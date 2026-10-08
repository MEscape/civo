import { RowListSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function OpeningHoursSkeleton() {
  return (
    <SectionSkeleton containerClassName="max-w-xl">
      <RowListSkeleton rows={7} />
    </SectionSkeleton>
  );
}

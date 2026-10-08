import { RowListSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function WasteCalendarSkeleton() {
  return (
    <SectionSkeleton tone="muted" containerClassName="max-w-2xl">
      <RowListSkeleton rows={6} />
    </SectionSkeleton>
  );
}

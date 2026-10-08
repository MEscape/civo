import { Skeleton } from '@components/ui/skeleton';

import { RowListSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function ServiceFinderSkeleton() {
  return (
    <SectionSkeleton>
      <Skeleton className="mb-6 h-10 w-full" />
      <RowListSkeleton rows={5} />
    </SectionSkeleton>
  );
}

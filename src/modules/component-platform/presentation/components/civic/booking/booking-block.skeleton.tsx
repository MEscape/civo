import { Skeleton } from '@components/ui/skeleton';

import { SectionSkeleton } from '../../shared/skeleton-blocks';

export function BookingBlockSkeleton() {
  return (
    <SectionSkeleton>
      <Skeleton className="mb-4 h-6 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </SectionSkeleton>
  );
}
